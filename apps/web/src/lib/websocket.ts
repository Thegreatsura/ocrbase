import type { JobUpdateMessage } from "@ocrbase/db/lib/enums";

import { env } from "@ocrbase/env/web";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const PING_INTERVAL_MS = 30_000;
const DEBUG_WEBSOCKET = import.meta.env.DEV;

const debugWebSocket = (
  jobId: string,
  event: string,
  details?: Record<string, unknown>
) => {
  if (!DEBUG_WEBSOCKET) {
    return;
  }
  if (details) {
    console.debug(`[ws:${jobId}] ${event}`, details);
    return;
  }
  console.debug(`[ws:${jobId}] ${event}`);
};

type Listener = (message: JobUpdateMessage) => void;

interface SharedConnection {
  addListener: (listener: Listener) => void;
  removeListener: (listener: Listener) => void;
  /** Number of active subscribers */
  refCount: number;
  /** Increment refCount; returns an unsubscribe function that decrements. */
  retain: () => () => void;
}

const connections = new Map<string, SharedConnection>();

/**
 * Returns a shared, ref-counted WebSocket connection for a job.
 *
 * Multiple callers subscribing to the same jobId will share a single
 * underlying WebSocket. The connection is torn down when the last
 * subscriber releases its reference.
 */
export function getJobConnection(jobId: string): SharedConnection {
  const existing = connections.get(jobId);
  if (existing) {
    return existing;
  }

  const listeners = new Set<Listener>();
  const terminal: { message: JobUpdateMessage | null } = { message: null };
  let ws: WebSocket | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;
  let retries = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;

  const emit = (message: JobUpdateMessage) => {
    for (const listener of listeners) {
      listener(message);
    }
  };

  const clearPing = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  };

  const teardown = () => {
    destroyed = true;
    clearPing();
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    if (ws) {
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
      ws = null;
    }
    connections.delete(jobId);
  };

  const connect = () => {
    if (destroyed) {
      return;
    }

    try {
      const wsUrl = new URL(`${env.VITE_SERVER_URL}/v1/realtime`);
      wsUrl.protocol = wsUrl.protocol.replace("http", "ws");
      wsUrl.searchParams.set("job_id", jobId);
      debugWebSocket(jobId, "connecting", {
        retries,
        url: wsUrl.toString(),
      });

      ws = new WebSocket(wsUrl.toString());

      ws.addEventListener("open", () => {
        if (destroyed) {
          ws?.close();
          return;
        }
        retries = 0;
        debugWebSocket(jobId, "open");
        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL_MS);
      });

      ws.addEventListener("message", (event: MessageEvent) => {
        let msg: JobUpdateMessage;
        try {
          msg = JSON.parse(event.data) as JobUpdateMessage;
        } catch {
          debugWebSocket(jobId, "message_parse_error", { raw: event.data });
          return;
        }
        if (
          msg.type === "completed" ||
          (msg.type === "error" && msg.data?.status === "failed")
        ) {
          terminal.message = msg;
        }
        emit(msg);
      });

      ws.addEventListener("close", (event) => {
        clearPing();
        debugWebSocket(jobId, "close", {
          code: event.code,
          reason: event.reason,
          retries,
        });
        if (destroyed) {
          return;
        }
        if (retries < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * 2 ** retries;
          retries += 1;
          debugWebSocket(jobId, "reconnect_scheduled", { delay, retries });
          retryTimeout = setTimeout(connect, delay);
          return;
        }
        debugWebSocket(jobId, "retries_exhausted");
        emit({
          data: { error: "Realtime connection closed" },
          jobId,
          type: "error",
        });
      });

      ws.addEventListener("error", () => {
        debugWebSocket(jobId, "socket_error");
        // The close handler will fire after this, triggering reconnect.
      });
    } catch {
      if (!destroyed && retries < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** retries;
        retries += 1;
        debugWebSocket(jobId, "connect_exception_reconnect_scheduled", {
          delay,
          retries,
        });
        retryTimeout = setTimeout(connect, delay);
        return;
      }
      if (!destroyed) {
        debugWebSocket(jobId, "connect_exception_retries_exhausted");
        emit({
          data: { error: "Realtime connection failed" },
          jobId,
          type: "error",
        });
      }
    }
  };

  const connection: SharedConnection = {
    addListener(listener: Listener) {
      listeners.add(listener);
      // Replay terminal message so late subscribers don't miss completion
      if (terminal.message) {
        listener(terminal.message);
      }
    },
    refCount: 0,
    removeListener(listener: Listener) {
      listeners.delete(listener);
    },
    retain() {
      connection.refCount += 1;
      let released = false;
      return () => {
        if (released) {
          return;
        }
        released = true;
        connection.refCount -= 1;
        if (connection.refCount <= 0) {
          teardown();
        }
      };
    },
  };

  connections.set(jobId, connection);
  connect();

  return connection;
}
