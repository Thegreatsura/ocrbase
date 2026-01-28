import type { EdenClient } from "../client";
import type { JobStatus, JobUpdateMessage, WebSocketCallbacks } from "../types";

export interface WebSocketClient {
  subscribeToJob: (jobId: string, callbacks: WebSocketCallbacks) => () => void;
}

type WebSocketMessage =
  | JobUpdateMessage
  | { type: "pong" }
  | { type: "error"; error: string };

const PING_INTERVAL_MS = 30_000;

export const createWebSocketClient = (eden: EdenClient): WebSocketClient => ({
  subscribeToJob: (jobId, callbacks) => {
    // Use Eden Treaty's type-safe WebSocket subscription
    const ws = eden.ws.jobs({ jobId }).subscribe();

    let pingInterval: ReturnType<typeof setInterval> | null = null;

    ws.on("open", () => {
      callbacks.onConnect?.();

      // Set up ping interval to keep connection alive
      pingInterval = setInterval(() => {
        ws.send({ type: "ping" });
      }, PING_INTERVAL_MS);
    });

    ws.on("message", (event) => {
      try {
        const message = event.data as WebSocketMessage;

        if (message.type === "pong") {
          return;
        }

        if (message.type === "error" && "error" in message) {
          callbacks.onError?.(message.error);
          return;
        }

        const jobMessage = message as JobUpdateMessage;

        if (jobMessage.type === "status" && jobMessage.data.status) {
          callbacks.onStatus?.(jobMessage.data.status as JobStatus);
        }

        if (jobMessage.type === "completed") {
          callbacks.onComplete?.({
            jsonResult: jobMessage.data.jsonResult,
            markdownResult: jobMessage.data.markdownResult,
            processingTimeMs: jobMessage.data.processingTimeMs,
          });
        }

        if (jobMessage.type === "error" && jobMessage.data.error) {
          callbacks.onError?.(jobMessage.data.error);
        }
      } catch {
        // Ignore invalid messages
      }
    });

    ws.on("close", () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }

      callbacks.onDisconnect?.();
    });

    ws.on("error", () => {
      callbacks.onError?.("WebSocket connection error");
    });

    return () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }

      ws.close();
    };
  },
});
