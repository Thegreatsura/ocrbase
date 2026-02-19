import { Elysia, t } from "elysia";

import { NotFoundError } from "../../lib/errors";
import { requireAuth } from "../../plugins/auth";
import { JobService } from "./service";
import { formatJobResponse, getWideEvent } from "./shared";

const sanitizeFileName = (name: string) => name.replaceAll(/["\r\n\\;]/g, "_");

const SAFE_INLINE_TYPES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);

const JobIdParams = t.Object({
  id: t.String({
    description: "Job ID",
    examples: ["job_abc123xyz"],
    pattern: "^job_[a-zA-Z0-9_-]+$",
  }),
});

const commonResponses = {
  401: { description: "Unauthorized - Invalid or missing API key" },
  429: { description: "Too Many Requests - Rate limit exceeded" },
  500: { description: "Internal Server Error" },
};

export const jobsRoutes = new Elysia({ prefix: "/v1/jobs" })
  .use(requireAuth)
  .get(
    "/",
    async ({ organization, query, user }) => {
      if (!user || !organization) {
        throw new Error("Unauthorized");
      }

      const result = await JobService.list(organization.id, user.id, {
        limit: query.limit,
        page: query.page,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        status: query.status,
        type: query.type,
      });

      return {
        data: result.data.map(formatJobResponse),
        pagination: result.pagination,
      };
    },
    {
      detail: {
        description: `List all jobs with filtering, sorting, and pagination.

Filter by status (pending, processing, extracting, completed, failed) or type (parse, extract).
Results are paginated with configurable page size (max 100).`,
        responses: {
          200: { description: "List of jobs with pagination metadata" },
          ...commonResponses,
        },
        tags: ["Jobs"],
      },
      query: t.Object({
        limit: t.Optional(
          t.Numeric({
            default: 20,
            description: "Number of results per page (1-100)",
            examples: [20],
            maximum: 100,
            minimum: 1,
          })
        ),
        page: t.Optional(
          t.Numeric({
            default: 1,
            description: "Page number",
            examples: [1],
            minimum: 1,
          })
        ),
        sortBy: t.Optional(
          t.Union([t.Literal("createdAt"), t.Literal("updatedAt")], {
            description: "Field to sort by",
            examples: ["createdAt"],
          })
        ),
        sortOrder: t.Optional(
          t.Union([t.Literal("asc"), t.Literal("desc")], {
            description: "Sort direction",
            examples: ["desc"],
          })
        ),
        status: t.Optional(
          t.Union(
            [
              t.Literal("pending"),
              t.Literal("processing"),
              t.Literal("extracting"),
              t.Literal("completed"),
              t.Literal("failed"),
            ],
            {
              description: "Filter by job status",
              examples: ["completed"],
            }
          )
        ),
        type: t.Optional(
          t.Union([t.Literal("parse"), t.Literal("extract")], {
            description: "Filter by job type",
            examples: ["parse"],
          })
        ),
      }),
    }
  )
  .get(
    "/:id",
    async (ctx) => {
      const { organization, params, user } = ctx;
      const wideEvent = getWideEvent(ctx);

      if (!user || !organization) {
        throw new Error("Unauthorized");
      }

      const job = await JobService.getById(organization.id, user.id, params.id);

      if (!job) {
        throw new NotFoundError("Job not found");
      }

      wideEvent?.setJob({
        id: job.id,
        pageCount: job.pageCount ?? undefined,
        status: job.status,
        type: job.type,
      });

      return formatJobResponse(job);
    },
    {
      detail: {
        description: `Get detailed information about a specific job.

Returns job status, metadata, processing times, and results (if completed).
For completed jobs, includes markdownResult and jsonResult (if extraction schema was used).`,
        responses: {
          200: { description: "Job details" },
          404: { description: "Not Found - Job does not exist" },
          ...commonResponses,
        },
        tags: ["Jobs"],
      },
      params: JobIdParams,
    }
  )
  .delete(
    "/:id",
    async (ctx) => {
      const { organization, params, user } = ctx;
      const wideEvent = getWideEvent(ctx);

      if (!user || !organization) {
        throw new Error("Unauthorized");
      }

      const job = await JobService.getById(organization.id, user.id, params.id);

      if (!job) {
        throw new NotFoundError("Job not found");
      }

      wideEvent?.setJob({ id: job.id, type: job.type });

      await JobService.delete(organization.id, user.id, params.id);

      return { success: true };
    },
    {
      detail: {
        description: `Permanently delete a job and all associated data.

This action cannot be undone. Deletes the job record, uploaded file, and any generated results.`,
        responses: {
          200: { description: "Job deleted successfully" },
          404: { description: "Not Found - Job does not exist" },
          ...commonResponses,
        },
        tags: ["Jobs"],
      },
      params: JobIdParams,
    }
  )
  .get(
    "/:id/file",
    async (ctx) => {
      const { organization, params, set, user } = ctx;

      if (!user || !organization) {
        throw new Error("Unauthorized");
      }

      const file = await JobService.getFileBuffer(
        organization.id,
        user.id,
        params.id
      );

      if (!file) {
        throw new NotFoundError("File not found");
      }

      const safeType = SAFE_INLINE_TYPES.has(file.mimeType)
        ? file.mimeType
        : "application/octet-stream";
      set.headers["Content-Type"] = safeType;
      set.headers["Content-Disposition"] =
        `inline; filename="${sanitizeFileName(file.fileName)}"`;
      set.headers["Content-Security-Policy"] = "sandbox";
      set.headers["X-Content-Type-Options"] = "nosniff";
      set.headers["Cache-Control"] = "private, max-age=3600";

      return file.buffer;
    },
    {
      detail: {
        description: `Download the original uploaded file.

Streams the file with appropriate Content-Type header for inline viewing.`,
        responses: {
          200: { description: "File content" },
          404: { description: "Not Found - Job or file does not exist" },
          ...commonResponses,
        },
        tags: ["Jobs"],
      },
      params: JobIdParams,
    }
  )
  .get(
    "/:id/download",
    async (ctx) => {
      const { organization, params, query, set, user } = ctx;
      const wideEvent = getWideEvent(ctx);

      if (!user || !organization) {
        throw new Error("Unauthorized");
      }

      const format = query.format ?? "md";
      const { content, contentType, fileName } =
        await JobService.getDownloadContent(
          organization.id,
          user.id,
          params.id,
          format
        );

      wideEvent?.setJob({ id: params.id });

      set.headers["Content-Type"] = contentType;
      set.headers["Content-Disposition"] =
        `attachment; filename="${sanitizeFileName(fileName)}"`;

      return content;
    },
    {
      detail: {
        description: `Download the job result as a file.

Choose between markdown (.md) or JSON (.json) format. JSON format is only available for jobs with extraction schemas.`,
        responses: {
          200: { description: "File download (markdown or JSON)" },
          400: {
            description:
              "Bad Request - Job not completed or JSON not available",
          },
          404: { description: "Not Found - Job does not exist" },
          ...commonResponses,
        },
        tags: ["Jobs"],
      },
      params: JobIdParams,
      query: t.Object({
        format: t.Optional(
          t.Union([t.Literal("md"), t.Literal("json")], {
            default: "md",
            description: "Download format",
            examples: ["md"],
          })
        ),
      }),
    }
  );
