import { env } from "@ocrbase/env/server";
import pino from "pino";

import { envContext } from "./env-context";

type WorkerJobSource = "api_upload" | "storage" | "url";

export interface WorkerJobContext {
  event: "job_processing";
  queue: "ocr-jobs";
  timestamp: string;
  jobId: string;
  requestId?: string;
  bullJobId?: string;
  source?: WorkerJobSource;
  type?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  pageCount?: number;
  schemaId?: string | null;
  apiKeyId?: string | null;
  status?: string;
  userId?: string;
  organizationId?: string;
  durationMs?: number;
  processingTimeMs?: number;
  storageDurationMs?: number;
  ocrDurationMs?: number;
  llmDurationMs?: number;
  llmModel?: string;
  tokenCount?: number;
  retry?: {
    attempt: number;
    maxAttempts: number;
    willRetryOnFailure: boolean;
  };
  outcome?: "success" | "error";
  error?: {
    code?: string;
    message: string;
    stack?: string;
  };
}

export const workerLogger = pino(
  {
    base: {
      env: envContext,
      service: "ocrbase-worker",
    },
    level: env.NODE_ENV === "production" ? "info" : "debug",
  },
  pino.destination(1)
);

export const createJobLogger = (
  jobId: string,
  bullJobId?: string
): pino.Logger => workerLogger.child({ bullJobId, jobId });
