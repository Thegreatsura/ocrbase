import { auth } from "@ocrbase/auth";
import { db } from "@ocrbase/db";
import { member, organization } from "@ocrbase/db/schema/auth";
import { jobs } from "@ocrbase/db/schema/jobs";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { validateApiKey } from "../../lib/api-key";
import {
  subscribeToJob,
  unsubscribeFromJob,
  type JobUpdateMessage,
} from "../../services/realtime";

const HEARTBEAT_INTERVAL_MS = 15_000;

const findJob = (jobId: string, organizationId: string) =>
  db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.organizationId, organizationId)),
  });

const formatSseEvent = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const jobsSse = new Elysia().get(
  "/v1/realtime",
  async ({ query, request, set }) => {
    const { api_key: apiKeyQuery, job_id: jobId } = query;

    let organizationId: string;

    // Try API key auth first (skip usage tracking for SSE)
    const authHeader =
      typeof apiKeyQuery === "string" && apiKeyQuery.length > 0
        ? `Bearer ${apiKeyQuery}`
        : request.headers.get("authorization");
    const apiKeyAuth = await validateApiKey(authHeader, {
      updateUsage: false,
    });
    if (apiKeyAuth) {
      ({ organizationId } = apiKeyAuth);
    } else {
      // Cookie auth (same-origin)
      const headers = new Headers();
      const cookie = request.headers.get("cookie");
      if (cookie) {
        headers.set("cookie", cookie);
      }
      const session = await auth.api.getSession({ headers });

      if (!session?.user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      // Resolve organization with the same fallback chain as requireAuth
      let resolvedOrgId = session.session.activeOrganizationId;

      if (!resolvedOrgId) {
        const [membership] = await db
          .select({ orgId: organization.id })
          .from(member)
          .innerJoin(organization, eq(member.organizationId, organization.id))
          .where(eq(member.userId, session.user.id))
          .limit(1);

        resolvedOrgId = membership?.orgId ?? null;
      }

      if (!resolvedOrgId) {
        set.status = 403;
        return { error: "No active organization" };
      }

      organizationId = resolvedOrgId;
    }

    const job = await findJob(jobId, organizationId);

    if (!job) {
      set.status = 404;
      return { error: "Job not found" };
    }

    set.headers["content-type"] = "text/event-stream";
    set.headers["cache-control"] = "no-cache";
    set.headers["connection"] = "keep-alive";
    set.headers["x-accel-buffering"] = "no";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const enqueue = (text: string) => {
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            // Stream already closed
          }
        };

        const closeStream = () => {
          clearInterval(heartbeat);
          unsubscribeFromJob(jobId, callback);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        };

        // Heartbeat to keep connection alive
        const heartbeat = setInterval(() => {
          enqueue(": heartbeat\n\n");
        }, HEARTBEAT_INTERVAL_MS);

        const callback = (message: JobUpdateMessage): void => {
          enqueue(formatSseEvent(message.type, message));

          if (message.type === "completed" || message.type === "error") {
            closeStream();
          }
        };

        // Subscribe first, then re-fetch to avoid missing events
        await subscribeToJob(jobId, callback);

        // Re-fetch after subscribing so we don't miss a completion that
        // happened between the initial query and the Redis SUBSCRIBE.
        const latestJob = await findJob(jobId, organizationId);
        const current = latestJob ?? job;

        if (current.status === "completed") {
          enqueue(
            formatSseEvent("completed", {
              data: {
                jsonResult: current.jsonResult ?? undefined,
                markdownResult: current.markdownResult ?? undefined,
                status: "completed",
              },
              jobId,
              type: "completed",
            })
          );
          closeStream();
          return;
        }

        if (current.status === "failed") {
          enqueue(
            formatSseEvent("error", {
              data: {
                error: current.errorMessage ?? "Job failed",
                status: "failed",
              },
              jobId,
              type: "error",
            })
          );
          closeStream();
          return;
        }

        enqueue(
          formatSseEvent("status", {
            data: { status: current.status },
            jobId,
            type: "status",
          })
        );
      },
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream",
        "x-accel-buffering": "no",
      },
    });
  },
  {
    detail: { hide: true },
    query: t.Object({
      api_key: t.Optional(t.String()),
      job_id: t.String(),
    }),
  }
);
