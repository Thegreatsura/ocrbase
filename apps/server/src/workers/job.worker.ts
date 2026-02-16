import { env } from "@ocrbase/env/server";
import { type Job as BullJob, Worker } from "bullmq";

import {
  completeJob,
  failJob,
  getJobById,
  updateJobFileInfo,
  updateJobStatus,
} from "@/lib/job-status";
import { type WorkerJobContext, workerLogger } from "@/lib/worker-logger";
import { llmService } from "@/services/llm";
import { parseDocument } from "@/services/ocr";
import { type JobData, getWorkerConnection } from "@/services/queue";
import { StorageService } from "@/services/storage";

interface ExtractionMetrics {
  llmDurationMs: number;
  llmModel: string;
  processingTimeMs: number;
  tokenCount: number;
}

const toErrorContext = (
  error: unknown
): NonNullable<WorkerJobContext["error"]> => {
  if (error instanceof Error) {
    return {
      code: error.name || "UNKNOWN_ERROR",
      message: error.message || "Unknown error",
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const {
      code: recordCode,
      message: recordMessage,
      name: recordName,
      stack: recordStack,
    } = record;

    let code = "UNKNOWN_ERROR";
    if (typeof recordCode === "string") {
      code = recordCode;
    } else if (typeof recordName === "string") {
      code = recordName;
    }
    const message =
      typeof recordMessage === "string" ? recordMessage : String(error);
    const stack = typeof recordStack === "string" ? recordStack : undefined;

    return { code, message, stack };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: String(error),
  };
};

const runExtraction = async (
  jobId: string,
  markdown: string,
  schema: Record<string, unknown> | undefined,
  hints: string | null,
  pageCount: number,
  startTime: number
): Promise<ExtractionMetrics> => {
  await updateJobStatus(jobId, "extracting");

  const llmStart = Date.now();
  const extractionResult = await llmService.processExtraction({
    hints: hints ?? undefined,
    markdown,
    schema,
  });
  const llmDurationMs = Date.now() - llmStart;

  const processingTimeMs = Date.now() - startTime;
  const tokenCount =
    extractionResult.usage.promptTokens +
    extractionResult.usage.completionTokens;

  await completeJob(jobId, {
    jsonResult: extractionResult.data,
    llmModel: extractionResult.model,
    llmUsage: extractionResult.usage,
    markdownResult: markdown,
    pageCount,
    processingTimeMs,
    tokenCount,
  });

  return {
    llmDurationMs,
    llmModel: extractionResult.model,
    processingTimeMs,
    tokenCount,
  };
};

const finishParseJob = async (
  jobId: string,
  markdown: string,
  pageCount: number,
  startTime: number
): Promise<number> => {
  const processingTimeMs = Date.now() - startTime;

  await completeJob(jobId, {
    markdownResult: markdown,
    pageCount,
    processingTimeMs,
  });

  return processingTimeMs;
};

const processJob = async (bullJob: BullJob<JobData>): Promise<void> => {
  const { jobId } = bullJob.data;
  const startTime = Date.now();
  const maxAttempts = bullJob.opts.attempts ?? 1;
  const attempt = bullJob.attemptsMade + 1;

  const eventContext: WorkerJobContext = {
    bullJobId: bullJob.id,
    event: "job_processing",
    jobId,
    queue: "ocr-jobs",
    requestId: bullJob.data.requestId,
    retry: {
      attempt,
      maxAttempts,
      willRetryOnFailure: attempt < maxAttempts,
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const job = await getJobById(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    eventContext.type = job.type;
    eventContext.fileName = job.fileName;
    eventContext.fileSize = job.fileSize;
    eventContext.mimeType = job.mimeType;
    eventContext.schemaId = job.schemaId;
    eventContext.apiKeyId = job.apiKeyId;
    eventContext.userId = job.userId;
    eventContext.organizationId = job.organizationId;

    await updateJobStatus(jobId, "processing", { startedAt: new Date() });

    let fileBuffer: Buffer;
    let { mimeType } = job;

    if (!job.fileKey && job.sourceUrl) {
      // URL job: fetch from source, process in memory, no S3
      const response = await fetch(job.sourceUrl);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch file from URL: ${response.statusText}`
        );
      }

      const contentType =
        response.headers.get("content-type") ?? "application/octet-stream";
      fileBuffer = Buffer.from(await response.arrayBuffer());
      mimeType = contentType;

      eventContext.source = "url";

      await updateJobFileInfo(jobId, {
        fileKey: null,
        fileName: job.fileName,
        fileSize: fileBuffer.length,
        mimeType: contentType,
      });
    } else if (job.fileKey) {
      // File upload: read from S3
      eventContext.source = "storage";
      const storageStart = Date.now();
      fileBuffer = await StorageService.getFile(job.fileKey);
      const storageDurationMs = Date.now() - storageStart;
      eventContext.storageDurationMs = storageDurationMs;
    } else {
      throw new Error("No file or URL provided for job");
    }

    const ocrStart = Date.now();
    const { markdown, pageCount } = await parseDocument(fileBuffer, mimeType);
    const ocrDurationMs = Date.now() - ocrStart;

    eventContext.pageCount = pageCount;
    eventContext.ocrDurationMs = ocrDurationMs;

    await updateJobStatus(jobId, "processing", {
      markdownResult: markdown,
      pageCount,
    });

    if (job.type === "extract") {
      const schema = job.schema?.jsonSchema as
        | Record<string, unknown>
        | undefined;
      const extractionMetrics = await runExtraction(
        jobId,
        markdown,
        schema,
        job.hints,
        pageCount,
        startTime
      );
      eventContext.llmDurationMs = extractionMetrics.llmDurationMs;
      eventContext.llmModel = extractionMetrics.llmModel;
      eventContext.processingTimeMs = extractionMetrics.processingTimeMs;
      eventContext.tokenCount = extractionMetrics.tokenCount;
    } else {
      eventContext.processingTimeMs = await finishParseJob(
        jobId,
        markdown,
        pageCount,
        startTime
      );
    }

    eventContext.status = "completed";
    eventContext.outcome = "success";
  } catch (error) {
    eventContext.status = "failed";
    eventContext.outcome = "error";
    eventContext.error = toErrorContext(error);

    throw error;
  } finally {
    eventContext.durationMs = Date.now() - startTime;
    eventContext.timestamp = new Date().toISOString();

    if (eventContext.outcome === "error") {
      workerLogger.error(eventContext, "job_processing");
    } else {
      workerLogger.info(eventContext, "job_processing");
    }
  }
};

const worker = new Worker<JobData>("ocr-jobs", processJob, {
  concurrency: env.WORKER_CONCURRENCY,
  connection: getWorkerConnection(),
});

worker.on("failed", async (job, error) => {
  const jobId = job?.data.jobId;

  if (jobId) {
    const errorCode = error.name || "PROCESSING_ERROR";
    const errorMessage = error.message || "Unknown error occurred";
    const attempts = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts.attempts ?? 3;
    const shouldRetry = attempts < maxAttempts;

    await failJob(jobId, errorCode, errorMessage, shouldRetry);
  }
});

worker.on("error", (error) => {
  workerLogger.error(
    {
      error: {
        code: error.name,
        message: error.message,
        stack: error.stack,
      },
    },
    "worker_error"
  );
});

const shutdown = async (): Promise<void> => {
  workerLogger.info({ event: "shutdown" }, "worker_lifecycle");
  await worker.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

workerLogger.info({ event: "startup" }, "worker_lifecycle");
