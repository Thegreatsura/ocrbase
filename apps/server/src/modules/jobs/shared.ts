import type { Job } from "@ocrbase/db/schema/jobs";

import type { WideEventContext } from "../../lib/wide-event";
import type { JobResponse } from "./model";

import { JobService } from "./service";

interface ContextWithWideEvent {
  wideEvent?: WideEventContext;
}

export const getWideEvent = (ctx: unknown): WideEventContext | undefined =>
  (ctx as ContextWithWideEvent).wideEvent;

export const formatJobResponse = (job: Job): JobResponse => ({
  completedAt: job.completedAt?.toISOString() ?? null,
  createdAt: job.createdAt.toISOString(),
  errorCode: job.errorCode,
  errorMessage: job.errorMessage,
  fileKey: job.fileKey,
  fileName: job.fileName,
  fileSize: job.fileSize,
  hints: job.hints,
  id: job.id,
  jsonResult: job.jsonResult ?? null,
  markdownResult: job.markdownResult,
  mimeType: job.mimeType,
  organizationId: job.organizationId,
  pageCount: job.pageCount,
  processingTimeMs: job.processingTimeMs,
  retryCount: job.retryCount,
  schemaId: job.schemaId,
  sourceUrl: job.sourceUrl,
  startedAt: job.startedAt?.toISOString() ?? null,
  status: job.status,
  tokenCount: job.tokenCount,
  type: job.type,
  updatedAt: job.updatedAt.toISOString(),
  userId: job.userId,
});

export const getErrorMessage = (caught: unknown, fallback: string): string =>
  caught instanceof Error ? caught.message : fallback;

const setWideEventJob = (
  wideEvent: WideEventContext | undefined,
  job: Job
): void => {
  wideEvent?.setJob({
    fileSize: job.fileSize,
    id: job.id,
    mimeType: job.mimeType,
    type: job.type,
  });
};

interface CreateJobHandlerOptions {
  type: "parse" | "extract";
}

export const createJobHandler = async <
  T extends {
    apiKey?: { id: string } | null;
    body: {
      file?: File;
      hints?: string;
      schemaId?: string;
      url?: string;
    };
    organization: { id: string } | null;
    requestId?: string;
    set: { status?: number | string };
    user: { id: string } | null;
  },
>(
  ctx: T,
  wideEvent: WideEventContext | undefined,
  options: CreateJobHandlerOptions
): Promise<JobResponse | { message: string }> => {
  const { apiKey, body, organization, requestId, set, user } = ctx;

  if (!user || !organization) {
    set.status = 401;
    return { message: "Unauthorized" };
  }

  const organizationId = organization.id;

  try {
    const hasValidUrl =
      typeof body.url === "string" &&
      body.url.length > 0 &&
      body.url.startsWith("http");

    if (hasValidUrl && body.url) {
      const job = await JobService.createFromUrl({
        apiKeyId: apiKey?.id,
        body: {
          hints: body.hints,
          schemaId: body.schemaId,
          type: options.type,
          url: body.url,
        },
        organizationId,
        requestId,
        userId: user.id,
      });

      setWideEventJob(wideEvent, job);
      return formatJobResponse(job);
    }

    if (!body.file) {
      set.status = 400;
      return { message: "File or URL is required" };
    }

    const { file } = body;
    const buffer = Buffer.from(await file.arrayBuffer());

    const job = await JobService.create({
      apiKeyId: apiKey?.id,
      body: {
        hints: body.hints,
        schemaId: body.schemaId,
        type: options.type,
      },
      file: {
        buffer,
        name: file.name,
        size: file.size,
        type: file.type,
      },
      organizationId,
      requestId,
      userId: user.id,
    });

    setWideEventJob(wideEvent, job);
    return formatJobResponse(job);
  } catch (error) {
    set.status = 500;
    return {
      message: getErrorMessage(error, `Failed to create ${options.type} job`),
    };
  }
};
