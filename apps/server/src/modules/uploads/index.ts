import { Elysia, t } from "elysia";

import { FileConstraints } from "../../lib/openapi";
import { requireAuth } from "../../plugins/auth";
import { JobService } from "../jobs/service";
import { formatJobResponse } from "../jobs/shared";

export const uploadsRoutes = new Elysia({ prefix: "/v1/uploads" })
  .use(requireAuth)
  .post(
    "/presign",
    async ({ body, organization, set, user }) => {
      if (!user || !organization) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const { job, uploadUrl } = await JobService.createForPresignedUpload({
        fileName: body.fileName,
        fileSize: body.fileSize,
        hints: body.hints,
        mimeType: body.mimeType,
        organizationId: organization.id,
        schemaId: body.schemaId,
        type: body.type,
        userId: user.id,
      });

      set.status = 200;
      return { jobId: job.id, uploadUrl };
    },
    {
      body: t.Object({
        fileName: t.String({ minLength: 1 }),
        fileSize: t.Number({
          maximum: FileConstraints.maxSizeBytes,
          minimum: 1,
        }),
        hints: t.Optional(t.String()),
        mimeType: t.Union([
          t.Literal("application/pdf"),
          t.Literal("image/png"),
          t.Literal("image/jpeg"),
          t.Literal("image/webp"),
          t.Literal("image/tiff"),
        ]),
        schemaId: t.Optional(t.String()),
        type: t.Union([t.Literal("parse"), t.Literal("extract")]),
      }),
      detail: {
        description:
          "Get a presigned URL for direct-to-S3 file upload. After uploading the file, call POST /v1/uploads/{jobId}/complete to start processing.",
        tags: ["Uploads"],
      },
    }
  )
  .post(
    "/:jobId/complete",
    async (ctx) => {
      const { organization, params, set, user } = ctx;
      if (!user || !organization) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const job = await JobService.confirmUpload({
        jobId: params.jobId,
        organizationId: organization.id,
        requestId: (ctx as unknown as { requestId?: string }).requestId,
        userId: user.id,
      });

      return formatJobResponse(job);
    },
    {
      detail: {
        description:
          "Confirm that a file has been uploaded to S3 and start processing the job.",
        tags: ["Uploads"],
      },
      params: t.Object({
        jobId: t.String({ minLength: 1 }),
      }),
    }
  );
