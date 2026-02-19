import type { JobStatus, JobType } from "@ocrbase/db/lib/enums";

import { db } from "@ocrbase/db";
import { jobs, type Job } from "@ocrbase/db/schema/jobs";
import { and, asc, count, desc, eq } from "drizzle-orm";

import type { CreateJobBody, ListJobsQuery, PaginationMeta } from "./model";

import { BadRequestError, NotFoundError } from "../../lib/errors";
import { addJob } from "../../services/queue";
import { StorageService } from "../../services/storage";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

interface CreateJobInput {
  apiKeyId?: string;
  body: CreateJobBody;
  file: {
    buffer: Buffer;
    name: string;
    size: number;
    type: string;
  };
  organizationId: string;
  requestId?: string;
  userId: string;
}

interface CreateJobFromUrlInput {
  apiKeyId?: string;
  body: CreateJobBody & { url: string };
  organizationId: string;
  requestId?: string;
  userId: string;
}

interface CreatePresignedUploadInput {
  fileName: string;
  fileSize: number;
  hints?: string;
  mimeType: string;
  organizationId: string;
  schemaId?: string;
  type: "parse" | "extract";
  userId: string;
}

interface ConfirmUploadInput {
  jobId: string;
  organizationId: string;
  requestId?: string;
  userId: string;
}

interface ListJobsResult {
  data: Job[];
  pagination: PaginationMeta;
}

const create = async (input: CreateJobInput): Promise<Job> => {
  const { apiKeyId, body, file, organizationId, requestId, userId } = input;

  const [newJob] = await db
    .insert(jobs)
    .values({
      apiKeyId,
      fileKey: null,
      fileName: file.name,
      fileSize: file.size,
      hints: body.hints,
      mimeType: file.type,
      organizationId,
      schemaId: body.schemaId,
      status: "pending",
      type: body.type,
      userId,
    })
    .returning();

  if (!newJob) {
    throw new Error("Failed to create job");
  }

  const fileKey = `${organizationId}/jobs/${newJob.id}/${file.name}`;

  await StorageService.uploadFile(fileKey, file.buffer, file.type);

  const [updatedJob] = await db
    .update(jobs)
    .set({ fileKey })
    .where(eq(jobs.id, newJob.id))
    .returning();

  if (!updatedJob) {
    throw new Error("Failed to update job with file key");
  }

  await addJob({
    jobId: updatedJob.id,
    organizationId,
    requestId,
    userId,
  });

  return updatedJob;
};

const extractFilenameFromUrl = (url: string): string => {
  try {
    const urlParts = new URL(url);
    const pathParts = urlParts.pathname.split("/").filter(Boolean);
    return pathParts.pop() ?? `download-${Date.now()}`;
  } catch {
    return `download-${Date.now()}`;
  }
};

const createFromUrl = async (input: CreateJobFromUrlInput): Promise<Job> => {
  const { apiKeyId, body, organizationId, requestId, userId } = input;

  const fileName = extractFilenameFromUrl(body.url);

  const [newJob] = await db
    .insert(jobs)
    .values({
      apiKeyId,
      fileKey: null,
      fileName,
      fileSize: 0,
      hints: body.hints,
      mimeType: "application/octet-stream",
      organizationId,
      schemaId: body.schemaId,
      sourceUrl: body.url,
      status: "pending",
      type: body.type,
      userId,
    })
    .returning();

  if (!newJob) {
    throw new Error("Failed to create job");
  }

  await addJob({
    jobId: newJob.id,
    organizationId,
    requestId,
    userId,
  });

  return newJob;
};

const getById = async (
  organizationId: string,
  _userId: string,
  jobId: string
): Promise<Job | null> => {
  const result = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.organizationId, organizationId)),
  });

  return result ?? null;
};

const deleteJob = async (
  organizationId: string,
  userId: string,
  jobId: string
): Promise<void> => {
  const job = await getById(organizationId, userId, jobId);

  if (!job) {
    throw new NotFoundError("Job not found");
  }

  if (job.fileKey) {
    try {
      await StorageService.deleteFile(job.fileKey);
    } catch {
      // Ignore storage deletion errors
    }
  }

  await db.delete(jobs).where(eq(jobs.id, jobId));
};

const list = async (
  organizationId: string,
  _userId: string,
  query: ListJobsQuery
): Promise<ListJobsResult> => {
  const page = query.page ?? DEFAULT_PAGE;
  const limit = query.limit ?? DEFAULT_LIMIT;
  const offset = (page - 1) * limit;

  const conditions = [eq(jobs.organizationId, organizationId)];

  if (query.type) {
    conditions.push(eq(jobs.type, query.type as JobType));
  }

  if (query.status) {
    conditions.push(eq(jobs.status, query.status as JobStatus));
  }

  const whereClause = and(...conditions);

  const sortColumn =
    query.sortBy === "updatedAt" ? jobs.updatedAt : jobs.createdAt;
  const orderByClause =
    query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [data, [countResult]] = await Promise.all([
    db.query.jobs.findMany({
      limit,
      offset,
      orderBy: orderByClause,
      where: whereClause,
    }),
    db.select({ count: count() }).from(jobs).where(whereClause),
  ]);

  const totalCount = countResult?.count ?? 0;
  const totalPages = Math.ceil(totalCount / limit);

  return {
    data,
    pagination: {
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      limit,
      totalCount,
      totalPages,
    },
  };
};

const getFileBuffer = async (
  organizationId: string,
  userId: string,
  jobId: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> => {
  const job = await getById(organizationId, userId, jobId);

  if (!job?.fileKey) {
    return null;
  }

  const buffer = await StorageService.getFile(job.fileKey);
  return {
    buffer,
    fileName: job.fileName,
    mimeType: job.mimeType,
  };
};

const getDownloadContent = async (
  organizationId: string,
  userId: string,
  jobId: string,
  format: "json" | "md" = "md"
): Promise<{ content: string; contentType: string; fileName: string }> => {
  const job = await getById(organizationId, userId, jobId);

  if (!job) {
    throw new NotFoundError("Job not found");
  }

  if (format === "json") {
    if (!job.jsonResult) {
      throw new BadRequestError("JSON result not available");
    }

    return {
      content: JSON.stringify(job.jsonResult, null, 2),
      contentType: "application/json",
      fileName: `${job.fileName.replace(/\.[^.]+$/, "")}.json`,
    };
  }

  if (!job.markdownResult) {
    throw new BadRequestError("Markdown result not available");
  }

  return {
    content: job.markdownResult,
    contentType: "text/markdown",
    fileName: `${job.fileName.replace(/\.[^.]+$/, "")}.md`,
  };
};

const createForPresignedUpload = async (
  input: CreatePresignedUploadInput
): Promise<{ job: Job; uploadUrl: string }> => {
  const {
    fileName,
    fileSize,
    hints,
    mimeType,
    organizationId,
    schemaId,
    type,
    userId,
  } = input;

  const [newJob] = await db
    .insert(jobs)
    .values({
      fileKey: null,
      fileName,
      fileSize,
      hints,
      mimeType,
      organizationId,
      schemaId,
      status: "pending",
      type,
      userId,
    })
    .returning();

  if (!newJob) {
    throw new Error("Failed to create job");
  }

  const fileKey = `${organizationId}/jobs/${newJob.id}/${fileName}`;

  const [updatedJob] = await db
    .update(jobs)
    .set({ fileKey })
    .where(eq(jobs.id, newJob.id))
    .returning();

  if (!updatedJob) {
    throw new Error("Failed to update job with file key");
  }

  const uploadUrl = StorageService.getPresignedUploadUrl(fileKey, mimeType);

  return { job: updatedJob, uploadUrl };
};

const confirmUpload = async (input: ConfirmUploadInput): Promise<Job> => {
  const { jobId, organizationId, requestId, userId } = input;

  const job = await getById(organizationId, userId, jobId);

  if (!job) {
    throw new NotFoundError("Job not found");
  }

  if (job.status !== "pending") {
    throw new BadRequestError("Job has already been submitted");
  }

  if (!job.fileKey) {
    throw new BadRequestError("Job has no file key");
  }

  const exists = await StorageService.fileExists(job.fileKey);
  if (!exists) {
    throw new BadRequestError("File has not been uploaded to storage yet");
  }

  await addJob({
    jobId: job.id,
    organizationId,
    requestId,
    userId,
  });

  return job;
};

export const JobService = {
  confirmUpload,
  create,
  createForPresignedUpload,
  createFromUrl,
  delete: deleteJob,
  getById,
  getDownloadContent,
  getFileBuffer,
  list,
};
