import type { JobUpdateMessage } from "@ocrbase/db/lib/enums";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import type { Job, JobListItem } from "@/lib/queries";

import { isJobProcessing, jobQueryOptions } from "@/lib/queries";
import { getJobConnection } from "@/lib/websocket";

interface JobsPageResponse {
  data: JobListItem[];
  pagination: {
    currentPage: number;
    hasNextPage: boolean;
    totalCount: number;
  };
}

const FALLBACK_RECONCILIATION_INTERVAL_MS = 2000;
const MAX_FALLBACK_ATTEMPTS = 10;
const REALTIME_UNAVAILABLE_MESSAGE =
  "Realtime connection was lost and status refresh failed. Please retry or reload.";
const DEBUG_JOB_REALTIME = import.meta.env.DEV;

const debugJobRealtime = (
  jobId: string,
  event: string,
  details?: Record<string, unknown>
) => {
  if (!DEBUG_JOB_REALTIME) {
    return;
  }
  if (details) {
    console.debug(`[job-realtime:${jobId}] ${event}`, details);
    return;
  }
  console.debug(`[job-realtime:${jobId}] ${event}`);
};

const updateJobsListStatus = (
  queryClient: QueryClient,
  jobId: string,
  status: JobListItem["status"]
) => {
  queryClient.setQueriesData<InfiniteData<JobsPageResponse>>(
    { queryKey: ["jobs"] },
    (old) => {
      if (!old) {
        return old;
      }
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: page.data.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status: resolveMonotonicStatus(job.status, status),
                }
              : job
          ),
        })),
      };
    }
  );
};

const isTerminalStatus = (
  status: JobListItem["status"] | undefined
): status is Extract<JobListItem["status"], "completed" | "failed"> =>
  status === "completed" || status === "failed";

const resolveMonotonicStatus = (
  currentStatus: JobListItem["status"] | undefined,
  nextStatus: JobListItem["status"]
): JobListItem["status"] =>
  isTerminalStatus(currentStatus) ? currentStatus : nextStatus;

/**
 * Subscribes to realtime updates for a single job (detail page).
 *
 * Automatically disconnects once the job reaches a terminal state
 * (completed / failed) and skips connecting entirely for jobs that
 * are already finished.
 */
export const useJobRealtime = (
  jobId: string,
  initialStatus?: JobListItem["status"]
) => {
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const activeJobIdRef = useRef(jobId);
  const initialStatusRef = useRef(initialStatus);

  if (activeJobIdRef.current !== jobId) {
    activeJobIdRef.current = jobId;
    initialStatusRef.current = initialStatus;
  }

  // Only update the ref when it transitions from undefined to a real value,
  // so the effect can gate on the first known status without re-running.
  if (initialStatus && !initialStatusRef.current) {
    initialStatusRef.current = initialStatus;
  }

  useEffect(() => {
    // Skip if already in a terminal state from the server fetch
    if (
      !jobId ||
      (initialStatusRef.current && !isJobProcessing(initialStatusRef.current))
    ) {
      return;
    }

    const conn = getJobConnection(jobId);
    const release = conn.retain();

    let done = false;
    let fallbackActive = false;
    let fallbackRun = 0;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const stopFallback = () => {
      fallbackActive = false;
      fallbackRun += 1;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const cleanup = () => {
      stopFallback();
      conn.removeListener(listener);
      release();
    };

    const startFallbackReconciliation = () => {
      if (fallbackActive) {
        return;
      }
      fallbackActive = true;
      fallbackRun += 1;
      const runId = fallbackRun;

      const qc = queryClientRef.current;
      let attempts = 0;
      debugJobRealtime(jobId, "fallback_start");

      const tick = async () => {
        if (!fallbackActive || done || runId !== fallbackRun) {
          return;
        }

        try {
          const latest = await qc.fetchQuery({
            ...jobQueryOptions(jobId),
            retry: false,
            staleTime: 0,
          });

          if (!fallbackActive || done || runId !== fallbackRun) {
            return;
          }

          attempts = 0;
          qc.setQueryData<Job>(["job", jobId], (old) =>
            old ? { ...old, errorMessage: null } : old
          );
          updateJobsListStatus(qc, jobId, latest.status);

          if (!isJobProcessing(latest.status)) {
            debugJobRealtime(jobId, "fallback_terminal", {
              status: latest.status,
            });
            done = true;
            cleanup();
            return;
          }
        } catch {
          if (!fallbackActive || done || runId !== fallbackRun) {
            return;
          }
          attempts += 1;
          if (attempts === 1 || attempts === MAX_FALLBACK_ATTEMPTS) {
            debugJobRealtime(jobId, "fallback_fetch_failed", { attempts });
          }
          if (attempts >= MAX_FALLBACK_ATTEMPTS) {
            debugJobRealtime(jobId, "fallback_exhausted");
            qc.setQueryData<Job>(["job", jobId], (old) =>
              old ? { ...old, errorMessage: REALTIME_UNAVAILABLE_MESSAGE } : old
            );
            done = true;
            cleanup();
            return;
          }
        }

        if (!fallbackActive || done || runId !== fallbackRun) {
          return;
        }
        fallbackTimer = setTimeout(tick, FALLBACK_RECONCILIATION_INTERVAL_MS);
      };

      tick();
    };

    const listener = (msg: JobUpdateMessage) => {
      if (done) {
        return;
      }
      const qc = queryClientRef.current;

      const updateJob = (updater: (job: Job) => Job) => {
        qc.setQueryData<Job>(["job", jobId], (old) =>
          old ? updater(old) : old
        );
      };

      switch (msg.type) {
        case "completed": {
          const hasMarkdownResult =
            msg.data !== undefined && Object.hasOwn(msg.data, "markdownResult");
          const hasJsonResult =
            msg.data !== undefined && Object.hasOwn(msg.data, "jsonResult");

          updateJob((job) => ({
            ...job,
            ...(hasJsonResult && msg.data?.jsonResult !== undefined
              ? { jsonResult: msg.data.jsonResult }
              : {}),
            ...(hasMarkdownResult && msg.data?.markdownResult !== undefined
              ? { markdownResult: msg.data.markdownResult }
              : {}),
            errorMessage: null,
            status: "completed",
          }));
          updateJobsListStatus(qc, jobId, "completed");
          qc.invalidateQueries({ queryKey: ["job", jobId] });
          done = true;
          cleanup();
          break;
        }
        case "error": {
          // "error" can represent a job failure or a non-job WS/auth issue.
          // Only mark the job failed when server explicitly sends failed status.
          const isJobFailure = msg.data?.status === "failed";
          if (isJobFailure) {
            updateJob((job) => ({
              ...job,
              errorMessage: msg.data?.error ?? "Unknown error",
              status: "failed",
            }));
            updateJobsListStatus(qc, jobId, "failed");
            qc.invalidateQueries({ queryKey: ["job", jobId] });
            done = true;
            cleanup();
            break;
          }
          // If realtime transport/auth fails, reconcile via server fetches so
          // the detail view and sidebar can still converge to terminal status.
          debugJobRealtime(jobId, "non_job_ws_error_fallback", {
            error: msg.data?.error,
          });
          cleanup();
          startFallbackReconciliation();
          break;
        }
        case "status": {
          const status = msg.data?.status;
          if (status) {
            let resolvedStatus: JobListItem["status"] = status;
            updateJob((job) => {
              resolvedStatus = resolveMonotonicStatus(job.status, status);
              return { ...job, errorMessage: null, status: resolvedStatus };
            });
            updateJobsListStatus(qc, jobId, resolvedStatus);
          }
          if (status === "completed" || status === "failed") {
            qc.invalidateQueries({ queryKey: ["job", jobId] });
            done = true;
            cleanup();
          }
          break;
        }
        default: {
          break;
        }
      }
    };

    conn.addListener(listener);

    return () => {
      done = true;
      cleanup();
    };
  }, [jobId]);
};
