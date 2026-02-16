import { pgEnum } from "drizzle-orm/pg-core";

export const jobTypeEnum = pgEnum("job_type", ["parse", "extract"]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "processing",
  "extracting",
  "completed",
  "failed",
]);

export type JobType = (typeof jobTypeEnum.enumValues)[number];
export type JobStatus = (typeof jobStatusEnum.enumValues)[number];

export type JobUpdateMessage =
  | {
      type: "status";
      jobId: string;
      data: {
        status: JobStatus;
        processingTimeMs?: number;
      };
    }
  | {
      type: "completed";
      jobId: string;
      data: {
        status: "completed";
        processingTimeMs?: number;
        markdownResult?: string;
        jsonResult?: unknown;
      };
    }
  | {
      type: "error";
      jobId: string;
      data: {
        error: string;
        status?: "failed";
      };
    }
  | {
      type: "pong";
      jobId: string;
    };
