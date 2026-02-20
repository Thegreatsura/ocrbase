import type { JobUpdateMessage } from "@ocrbase/db/lib/enums";

import { env } from "@ocrbase/env/web";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const DEBUG_SSE = import.meta.env.DEV;

const debugSSE = (
  jobId: string,
  event: string,
  details?: Record<string, unknown>
) => {
  if (!DEBUG_SSE) {
    return;
  }
  if (details) {
    console.debug(`[sse:${jobId}] ${event}`, details);
    return;
  }
  console.debug(`[sse:${jobId}] ${event}`);
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
 * Returns a shared, ref-counted EventSource connection for a job.
 *
 * Multiple callers subscribing to the same jobId will share a single
 * underlying EventSource. The connection is torn down when the last
 * subscriber releases its reference.
 */
export function getJobConnection(jobId: string): SharedConnection {
  const existing = connections.get(jobId);
  if (existing) {
    return existing;
  }

  const listeners = new Set<Listener>();
  const terminal: { message: JobUpdateMessage | null } = { message: null };
  let es: EventSource | null = null;
  let destroyed = false;
  let retries = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;

  const emit = (message: JobUpdateMessage) => {
    for (const listener of listeners) {
      listener(message);
    }
  };

  const teardown = () => {
    destroyed = true;
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    if (es) {
      es.close();
      es = null;
    }
    connections.delete(jobId);
  };

  const scheduleReconnect = () => {
    if (destroyed) {
      return;
    }
    if (retries < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * 2 ** retries;
      retries += 1;
      debugSSE(jobId, "reconnect_scheduled", { delay, retries });
      retryTimeout = setTimeout(connect, delay);
      return;
    }
    debugSSE(jobId, "retries_exhausted");
    emit({
      data: { error: "Realtime connection closed" },
      jobId,
      type: "error",
    });
  };

  const connect = () => {
    if (destroyed) {
      return;
    }

    try {
      const sseUrl = new URL(`${env.VITE_SERVER_URL}/v1/realtime`);
      sseUrl.searchParams.set("job_id", jobId);
      debugSSE(jobId, "connecting", {
        retries,
        url: sseUrl.toString(),
      });

      es = new EventSource(sseUrl.toString(), { withCredentials: true });

      es.addEventListener("status", (event: MessageEvent) => {
        let msg: JobUpdateMessage;
        try {
          msg = JSON.parse(event.data) as JobUpdateMessage;
        } catch {
          debugSSE(jobId, "message_parse_error", { raw: event.data });
          return;
        }
        retries = 0;
        emit(msg);
      });

      es.addEventListener("completed", (event: MessageEvent) => {
        let msg: JobUpdateMessage;
        try {
          msg = JSON.parse(event.data) as JobUpdateMessage;
        } catch {
          debugSSE(jobId, "message_parse_error", { raw: event.data });
          return;
        }
        retries = 0;
        terminal.message = msg;
        emit(msg);
      });

      es.addEventListener("error", (event: Event) => {
        // The "error" event on EventSource fires for BOTH server-sent
        // error events (MessageEvent) and connection issues.
        if (event instanceof MessageEvent) {
          // Server-sent error event — parse as job error
          let msg: JobUpdateMessage;
          try {
            msg = JSON.parse(event.data) as JobUpdateMessage;
          } catch {
            debugSSE(jobId, "message_parse_error", { raw: event.data });
            return;
          }
          if (msg.type === "error" && msg.data?.status === "failed") {
            terminal.message = msg;
          }
          emit(msg);
          return;
        }

        // Connection error
        debugSSE(jobId, "connection_error", {
          readyState: es?.readyState,
        });

        // EventSource auto-reconnects when readyState is CONNECTING.
        // When the browser has given up (readyState === CLOSED), we
        // need to handle reconnection ourselves.
        if (es?.readyState === EventSource.CLOSED) {
          es.close();
          es = null;
          scheduleReconnect();
        }
      });

      // EventSource fires "open" when the connection is established
      es.addEventListener("open", () => {
        if (destroyed) {
          es?.close();
          return;
        }
        retries = 0;
        debugSSE(jobId, "open");
      });
    } catch {
      if (!destroyed && retries < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** retries;
        retries += 1;
        debugSSE(jobId, "connect_exception_reconnect_scheduled", {
          delay,
          retries,
        });
        retryTimeout = setTimeout(connect, delay);
        return;
      }
      if (!destroyed) {
        debugSSE(jobId, "connect_exception_retries_exhausted");
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
