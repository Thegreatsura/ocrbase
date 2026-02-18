import { auth } from "@ocrbase/auth";
import { db } from "@ocrbase/db";
import { jobs } from "@ocrbase/db/schema/jobs";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { validateApiKey } from "../../lib/api-key";
import {
  subscribeToJob,
  unsubscribeFromJob,
  type JobUpdateMessage,
} from "../../services/websocket";

interface WebSocketData {
  jobId: string;
  userId: string;
  organizationId: string;
  callback: (message: JobUpdateMessage) => void;
}

const JobStatusSchema = t.Union([
  t.Literal("pending"),
  t.Literal("processing"),
  t.Literal("extracting"),
  t.Literal("completed"),
  t.Literal("failed"),
]);

const JobUpdateSchema = t.Union([
  t.Object({
    data: t.Object({
      processingTimeMs: t.Optional(t.Number()),
      status: JobStatusSchema,
    }),
    jobId: t.String(),
    type: t.Literal("status"),
  }),
  t.Object({
    data: t.Object({
      jsonResult: t.Optional(t.Unknown()),
      markdownResult: t.Optional(t.String()),
      processingTimeMs: t.Optional(t.Number()),
      status: t.Literal("completed"),
    }),
    jobId: t.String(),
    type: t.Literal("completed"),
  }),
  t.Object({
    data: t.Object({
      error: t.String(),
      status: t.Optional(t.Literal("failed")),
    }),
    jobId: t.String(),
    type: t.Literal("error"),
  }),
  t.Object({
    jobId: t.String(),
    type: t.Literal("pong"),
  }),
]);

const ClientMessageSchema = t.Object({
  type: t.Union([t.Literal("ping")]),
});

interface WsContext {
  send: (msg: JobUpdateMessage) => void;
  close: () => void;
}

const sendErrorAndClose = (ws: WsContext, jobId: string, error: string) => {
  ws.send({ data: { error }, jobId, type: "error" });
  ws.close();
};

const findJob = (jobId: string, organizationId: string) =>
  db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.organizationId, organizationId)),
  });

export const jobsWebSocket = new Elysia().ws("/v1/realtime", {
  body: ClientMessageSchema,
  close(ws) {
    const { wsData } = ws.data as unknown as { wsData?: WebSocketData };
    if (wsData) {
      unsubscribeFromJob(wsData.jobId, wsData.callback);
    }
  },
  message(ws, message) {
    if (message.type === "ping") {
      ws.send({ jobId: ws.data.query.job_id, type: "pong" });
    }
  },

  async open(ws) {
    const { api_key: apiKeyQuery, job_id: jobId } = ws.data.query;

    let userId: string;
    let organizationId: string;

    // Try API key auth first (skip usage tracking for websocket)
    const authHeader =
      typeof apiKeyQuery === "string" && apiKeyQuery.length > 0
        ? `Bearer ${apiKeyQuery}`
        : ws.data.headers?.authorization;
    const apiKeyAuth = await validateApiKey(authHeader, { updateUsage: false });
    if (apiKeyAuth) {
      ({ userId } = apiKeyAuth);
      ({ organizationId } = apiKeyAuth);
    } else {
      // Cookie auth (same-origin)
      const headers = new Headers();
      const cookie = ws.data.headers?.cookie;
      if (cookie) {
        headers.set("cookie", cookie);
      }
      const session = await auth.api.getSession({ headers });

      if (!session?.user || !session.session.activeOrganizationId) {
        sendErrorAndClose(ws, jobId, "Unauthorized");
        return;
      }

      userId = session.user.id;
      organizationId = session.session.activeOrganizationId;
    }

    const job = await findJob(jobId, organizationId);

    if (!job) {
      sendErrorAndClose(ws, jobId, "Job not found");
      return;
    }

    const callback = (message: JobUpdateMessage): void => {
      ws.send(message);
    };

    (ws.data as unknown as { wsData: WebSocketData }).wsData = {
      callback,
      jobId,
      organizationId,
      userId,
    };

    // Ensure Redis subscription is ready before we send initial state.
    // Otherwise, a fast job completion can be published before the subscriber
    // is actually subscribed, and the client will miss the "completed" event.
    await subscribeToJob(jobId, callback);

    // Re-fetch after subscribing so we don't miss a completion that happened
    // between the initial query above and the Redis SUBSCRIBE completing.
    const latestJob = (await findJob(jobId, organizationId)) ?? job;

    // Send initial state with results if available
    if (latestJob.status === "completed") {
      ws.send({
        data: {
          jsonResult: latestJob.jsonResult ?? undefined,
          markdownResult: latestJob.markdownResult ?? undefined,
          status: "completed",
        },
        jobId,
        type: "completed",
      });
    } else if (latestJob.status === "failed") {
      ws.send({
        data: {
          error: latestJob.errorMessage ?? "Job failed",
          status: "failed",
        },
        jobId,
        type: "error",
      });
    } else {
      ws.send({
        data: { status: latestJob.status },
        jobId,
        type: "status",
      });
    }
  },

  query: t.Object({
    api_key: t.Optional(t.String()),
    job_id: t.String(),
  }),

  response: JobUpdateSchema,
});
