import type { JobStatus } from "@ocrbase/db/lib/enums";

import { db } from "@ocrbase/db";
import { apiKeyUsageDaily, usageEvents } from "@ocrbase/db/schema/api-keys";
import { jobs } from "@ocrbase/db/schema/jobs";
import { eq, sql } from "drizzle-orm";

import type { LlmUsage } from "@/services/llm";

import { publishJobUpdate } from "@/services/websocket";

interface UpdateData {
  status?: JobStatus;
  markdownResult?: string;
  jsonResult?: unknown;
  pageCount?: number;
  tokenCount?: number;
  errorCode?: string;
  errorMessage?: string;
  retryCount?: number;
  startedAt?: Date;
  completedAt?: Date;
  processingTimeMs?: number;
}

export interface CompleteJobResult {
  markdownResult: string;
  jsonResult?: unknown;
  pageCount: number;
  tokenCount?: number;
  llmModel?: string;
  llmUsage?: LlmUsage;
  processingTimeMs: number;
}

export const updateJobStatus = async (
  jobId: string,
  status: JobStatus,
  data?: Omit<UpdateData, "status">
): Promise<void> => {
  await db
    .update(jobs)
    .set({
      status,
      ...data,
    })
    .where(eq(jobs.id, jobId));

  await publishJobUpdate(jobId, {
    data: {
      processingTimeMs: data?.processingTimeMs,
      status,
    },
    jobId,
    type: "status",
  });
};

export const completeJob = async (
  jobId: string,
  result: CompleteJobResult
): Promise<void> => {
  const completedAt = new Date();

  const [updatedJob] = await db
    .update(jobs)
    .set({
      completedAt,
      jsonResult: result.jsonResult,
      llmModel: result.llmModel,
      markdownResult: result.markdownResult,
      pageCount: result.pageCount,
      processingTimeMs: result.processingTimeMs,
      status: "completed",
      tokenCount: result.tokenCount,
    })
    .where(eq(jobs.id, jobId))
    .returning({ apiKeyId: jobs.apiKeyId });

  if (updatedJob?.apiKeyId) {
    const today = completedAt.toISOString().split("T")[0] as string;
    const promptTokens = result.llmUsage?.promptTokens ?? 0;
    const completionTokens = result.llmUsage?.completionTokens ?? 0;
    const { apiKeyId } = updatedJob;

    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(usageEvents)
        .values({
          apiKeyId,
          completionTokens,
          jobId,
          model: result.llmModel ?? null,
          pages: result.pageCount,
          promptTokens,
        })
        .onConflictDoNothing({ target: usageEvents.jobId })
        .returning({ id: usageEvents.id });

      // Only update daily aggregate if event was inserted (not a retry)
      if (inserted) {
        await tx
          .insert(apiKeyUsageDaily)
          .values({
            apiKeyId,
            completionTokens,
            day: today,
            jobsCount: 1,
            pages: result.pageCount,
            promptTokens,
          })
          .onConflictDoUpdate({
            set: {
              completionTokens: sql`${apiKeyUsageDaily.completionTokens} + ${completionTokens}`,
              jobsCount: sql`${apiKeyUsageDaily.jobsCount} + 1`,
              pages: sql`${apiKeyUsageDaily.pages} + ${result.pageCount}`,
              promptTokens: sql`${apiKeyUsageDaily.promptTokens} + ${promptTokens}`,
            },
            target: [apiKeyUsageDaily.apiKeyId, apiKeyUsageDaily.day],
          });
      }
    });
  }

  await publishJobUpdate(jobId, {
    data: {
      jsonResult: result.jsonResult,
      markdownResult: result.markdownResult,
      processingTimeMs: result.processingTimeMs,
      status: "completed",
    },
    jobId,
    type: "completed",
  });
};

export const failJob = async (
  jobId: string,
  errorCode: string,
  errorMessage: string,
  shouldRetry = false
): Promise<void> => {
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
  });

  const retryCount = (job?.retryCount ?? 0) + 1;

  await db
    .update(jobs)
    .set({
      errorCode,
      errorMessage,
      retryCount,
      status: "failed",
    })
    .where(eq(jobs.id, jobId));

  if (!shouldRetry) {
    await publishJobUpdate(jobId, {
      data: {
        error: errorMessage,
        status: "failed",
      },
      jobId,
      type: "error",
    });
  }
};

export const getJobById = (jobId: string) =>
  db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
    with: {
      schema: true,
    },
  });

export const updateJobFileInfo = async (
  jobId: string,
  fileInfo: {
    fileKey: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }
): Promise<void> => {
  await db
    .update(jobs)
    .set({
      fileKey: fileInfo.fileKey,
      fileName: fileInfo.fileName,
      fileSize: fileInfo.fileSize,
      mimeType: fileInfo.mimeType,
    })
    .where(eq(jobs.id, jobId));
};
