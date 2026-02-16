import { Elysia } from "elysia";
import { nanoid } from "nanoid";

import { envContext } from "../lib/env-context";
import { posthog } from "../lib/posthog";
import { type WideEventData, WideEventContext } from "../lib/wide-event";
import { logger } from "./logging";

const createRequestId = (): string => `req_${nanoid(12)}`;

const ERROR_STATUS_BY_CODE: Record<string, number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PARSE: 400,
  UNAUTHORIZED: 401,
  VALIDATION: 400,
};

const getStatusCode = (
  status: number | string | undefined,
  fallback: number
): number => {
  if (typeof status === "number") {
    return status;
  }

  if (typeof status === "string") {
    const parsed = Number(status);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const getErrorStatusCode = (
  code: unknown,
  status: number | string | undefined
): number => {
  if (typeof code === "string") {
    const mappedStatus = ERROR_STATUS_BY_CODE[code];
    if (mappedStatus) {
      return mappedStatus;
    }
  }

  const statusCode = getStatusCode(status, 500);
  return statusCode >= 400 ? statusCode : 500;
};

const captureApiRequest = (event: WideEventData): void => {
  if (!posthog) {
    return;
  }

  const distinctId = event.user?.id ?? `anon_${event.requestId}`;
  posthog.capture({
    distinctId,
    event: "api_request",
    groups: event.organization
      ? { organization: event.organization.id }
      : undefined,
    properties: {
      $set: event.user ? { email: event.user.email } : undefined,
      api_key_id: event.auth?.apiKeyId,
      auth_type: event.auth?.type ?? "anonymous",
      duration_ms: event.durationMs,
      error_code: event.error?.code,
      error_message: event.error?.message,
      method: event.method,
      outcome: event.outcome,
      path: event.path,
      status_code: event.statusCode,
    },
  });
};

const emitWideEvent = ({
  requestId,
  set,
  statusCode,
  wideEvent,
}: {
  requestId: string;
  set: { headers: Record<string, string | number> };
  statusCode: number;
  wideEvent: WideEventContext;
}): void => {
  set.headers["X-Request-Id"] = requestId;
  const event = wideEvent.finalizeOnce(statusCode);

  if (!event) {
    return;
  }

  if (event.outcome === "error") {
    logger.error(event);
  } else {
    logger.info(event);
  }

  captureApiRequest(event);
};

export const wideEventPlugin = new Elysia({ name: "wideEvent" })
  .derive({ as: "global" }, ({ request }) => {
    const url = new URL(request.url);
    const requestId = createRequestId();
    const wideEvent = new WideEventContext({
      env: envContext,
      method: request.method,
      path: url.pathname,
      requestId,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return { requestId, wideEvent };
  })
  .onAfterHandle({ as: "global" }, ({ requestId, set, wideEvent }) => {
    if (!wideEvent || !requestId) {
      return;
    }

    emitWideEvent({
      requestId,
      set: { headers: set.headers },
      statusCode: getStatusCode(set.status, 200),
      wideEvent,
    });
  })
  .onError({ as: "global" }, ({ code, error, requestId, set, wideEvent }) => {
    if (!wideEvent || !requestId) {
      return;
    }

    const errorCode = error instanceof Error ? error.name : "UNKNOWN_ERROR";
    wideEvent.setError({
      code: typeof code === "string" ? code : errorCode,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    emitWideEvent({
      requestId,
      set: { headers: set.headers },
      statusCode: getErrorStatusCode(code, set.status),
      wideEvent,
    });
  });
