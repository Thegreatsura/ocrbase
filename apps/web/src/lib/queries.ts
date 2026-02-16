import type { JobStatus } from "@ocrbase/db/lib/enums";

import { env } from "@ocrbase/env/web";
import {
  type InfiniteData,
  infiniteQueryOptions,
  queryOptions,
} from "@tanstack/react-query";

import { api } from "./api";

export type { JobStatus };

export interface Job {
  id: string;
  type: "parse" | "extract";
  status: JobStatus;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  pageCount: number | null;
  markdownResult: string | null;
  jsonResult: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export const isJobProcessing = (status: JobStatus | undefined): boolean =>
  !status ||
  status === "pending" ||
  status === "processing" ||
  status === "extracting";

export const jobQueryOptions = (jobId: string) =>
  queryOptions({
    queryFn: async (): Promise<Job> => {
      const res = await api.v1.jobs({ id: jobId }).get();
      if (res.error) {
        throw new Error(
          typeof res.error === "object" && "message" in res.error
            ? String(res.error.message)
            : "Failed to fetch job"
        );
      }
      return {
        ...(res.data as unknown as Job),
        fileUrl: `${env.VITE_SERVER_URL}/v1/jobs/${jobId}/file`,
      };
    },
    queryKey: ["job", jobId],
    staleTime: 5000,
  });

export interface JobListItem {
  id: string;
  type: "parse" | "extract";
  status: JobStatus;
  fileName: string | null;
  createdAt: string;
}

interface JobsPageResponse {
  data: JobListItem[];
  pagination: {
    currentPage: number;
    hasNextPage: boolean;
    totalCount: number;
  };
}

export const jobsInfiniteQueryOptions = () =>
  infiniteQueryOptions<
    JobsPageResponse,
    Error,
    InfiniteData<JobsPageResponse>,
    string[],
    number
  >({
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNextPage
        ? lastPage.pagination.currentPage + 1
        : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<JobsPageResponse> => {
      const res = await api.v1.jobs.get({
        query: {
          limit: 10,
          page: pageParam,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });
      if (res.error) {
        throw new Error("Failed to fetch jobs");
      }
      return res.data as unknown as JobsPageResponse;
    },
    queryKey: ["jobs"],
    staleTime: 60_000,
  });
