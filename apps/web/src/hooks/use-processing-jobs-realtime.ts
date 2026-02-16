import type { JobUpdateMessage } from "@ocrbase/db/lib/enums";
import type { InfiniteData } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

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
const DEBUG_JOBS_REALTIME = import.meta.env.DEV;

const debugJobsRealtime = (
  jobId: string,
  event: string,
  details?: Record<string, unknown>
) => {
  if (!DEBUG_JOBS_REALTIME) {
    return;
  }
  if (details) {
    console.debug(`[jobs-realtime:${jobId}] ${event}`, details);
    return;
  }
  console.debug(`[jobs-realtime:${jobId}] ${event}`);
};

const isTerminalStatus = (
  status: JobListItem["status"] | undefined
): status is Extract<JobListItem["status"], "completed" | "failed"> =>
  status === "completed" || status === "failed";

/**
 * Opens a shared WebSocket connection for each processing job,
 * updating only the sidebar's `["jobs"]` list cache as status changes.
 *
 * Individual job query invalidation is left to `useJobRealtime` to
 * avoid double-invalidation.
 */
export const useProcessingJobsRealtime = (processingJobIds: string[]) => {
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const cleanupMap = useRef<Map<string, () => void>>(new Map());
  const fallbackActiveRef = useRef<Set<string>>(new Set());
  const fallbackRunRef = useRef<Map<string, number>>(new Map());
  const fallbackAttemptsRef = useRef<Map<string, number>>(new Map());
  const fallbackTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const terminalStatusesRef = useRef<
    Map<string, Extract<JobListItem["status"], "completed" | "failed">>
  >(new Map());

  const stopFallback = useCallback((jobId: string) => {
    fallbackActiveRef.current.delete(jobId);
    fallbackRunRef.current.delete(jobId);
    const timer = fallbackTimersRef.current.get(jobId);
    if (timer) {
      clearTimeout(timer);
      fallbackTimersRef.current.delete(jobId);
    }
    fallbackAttemptsRef.current.delete(jobId);
  }, []);

  const markRealtimeUnavailable = useCallback((jobId: string) => {
    queryClientRef.current.setQueryData<Job>(["job", jobId], (old) =>
      old ? { ...old, errorMessage: REALTIME_UNAVAILABLE_MESSAGE } : old
    );
  }, []);

  const applyTerminalStatuses = useCallback(() => {
    const qc = queryClientRef.current;
    const terminalStatuses = terminalStatusesRef.current;

    if (terminalStatuses.size === 0) {
      return;
    }

    const current = qc.getQueryData<InfiniteData<JobsPageResponse>>(["jobs"]);
    if (!current) {
      return;
    }

    let changed = false;
    const pages = current.pages.map((page) => {
      let pageChanged = false;
      const data = page.data.map((job) => {
        const terminalStatus = terminalStatuses.get(job.id);
        if (!terminalStatus || job.status === terminalStatus) {
          return job;
        }
        pageChanged = true;
        changed = true;
        return { ...job, status: terminalStatus };
      });

      return pageChanged ? { ...page, data } : page;
    });

    if (!changed) {
      return;
    }

    qc.setQueryData<InfiniteData<JobsPageResponse>>(["jobs"], {
      ...current,
      pages,
    });
  }, []);

  const setJobStatus = useCallback(
    (jobId: string, nextStatus: JobListItem["status"]) => {
      let resolvedStatus = nextStatus;
      if (isTerminalStatus(nextStatus)) {
        terminalStatusesRef.current.set(jobId, nextStatus);
      } else {
        const terminalStatus = terminalStatusesRef.current.get(jobId);
        if (terminalStatus) {
          resolvedStatus = terminalStatus;
        }
      }

      queryClientRef.current.setQueryData<InfiniteData<JobsPageResponse>>(
        ["jobs"],
        (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((job) =>
                job.id === jobId ? { ...job, status: resolvedStatus } : job
              ),
            })),
          };
        }
      );
    },
    []
  );

  const startFallback = useCallback(
    (jobId: string) => {
      if (fallbackActiveRef.current.has(jobId)) {
        return;
      }
      fallbackActiveRef.current.add(jobId);
      const runId = (fallbackRunRef.current.get(jobId) ?? 0) + 1;
      fallbackRunRef.current.set(jobId, runId);
      debugJobsRealtime(jobId, "fallback_start");

      const tick = async () => {
        if (
          !fallbackActiveRef.current.has(jobId) ||
          fallbackRunRef.current.get(jobId) !== runId
        ) {
          return;
        }

        const attempts = fallbackAttemptsRef.current.get(jobId) ?? 0;

        try {
          const latest = await queryClientRef.current.fetchQuery({
            ...jobQueryOptions(jobId),
            retry: false,
            staleTime: 0,
          });

          if (
            !fallbackActiveRef.current.has(jobId) ||
            fallbackRunRef.current.get(jobId) !== runId
          ) {
            return;
          }

          fallbackAttemptsRef.current.set(jobId, 0);
          queryClientRef.current.setQueryData<Job>(["job", jobId], (old) =>
            old ? { ...old, errorMessage: null } : old
          );
          setJobStatus(jobId, latest.status);

          if (!isJobProcessing(latest.status)) {
            debugJobsRealtime(jobId, "fallback_terminal", {
              status: latest.status,
            });
            stopFallback(jobId);
            return;
          }
        } catch {
          if (
            !fallbackActiveRef.current.has(jobId) ||
            fallbackRunRef.current.get(jobId) !== runId
          ) {
            return;
          }

          const nextAttempts = attempts + 1;
          fallbackAttemptsRef.current.set(jobId, nextAttempts);
          if (nextAttempts === 1 || nextAttempts === MAX_FALLBACK_ATTEMPTS) {
            debugJobsRealtime(jobId, "fallback_fetch_failed", {
              attempts: nextAttempts,
            });
          }
          if (nextAttempts >= MAX_FALLBACK_ATTEMPTS) {
            debugJobsRealtime(jobId, "fallback_exhausted");
            markRealtimeUnavailable(jobId);
            stopFallback(jobId);
            return;
          }
        }

        if (
          !fallbackActiveRef.current.has(jobId) ||
          fallbackRunRef.current.get(jobId) !== runId
        ) {
          return;
        }

        const timer = setTimeout(tick, FALLBACK_RECONCILIATION_INTERVAL_MS);
        fallbackTimersRef.current.set(jobId, timer);
      };

      tick();
    },
    [markRealtimeUnavailable, setJobStatus, stopFallback]
  );

  useEffect(() => {
    const currentIds = new Set(processingJobIds);

    // Tear down connections for jobs no longer processing
    for (const [id, cleanup] of cleanupMap.current) {
      if (!currentIds.has(id)) {
        cleanup();
        stopFallback(id);
        cleanupMap.current.delete(id);
      }
    }

    // Open connections for new processing jobs
    for (const jobId of processingJobIds) {
      if (cleanupMap.current.has(jobId)) {
        continue;
      }

      const conn = getJobConnection(jobId);
      const release = conn.retain();

      const listener = (msg: JobUpdateMessage) => {
        let nextStatus: JobListItem["status"] | undefined;
        if (msg.type === "status") {
          nextStatus = msg.data?.status;
        } else if (msg.type === "completed") {
          nextStatus = "completed";
        } else if (msg.type === "error" && msg.data?.status === "failed") {
          nextStatus = "failed";
        } else if (msg.type === "error") {
          debugJobsRealtime(jobId, "non_job_ws_error_fallback", {
            error: msg.data?.error,
          });
          startFallback(jobId);
          return;
        }

        if (!nextStatus) {
          return;
        }
        stopFallback(jobId);
        setJobStatus(jobId, nextStatus);
      };

      conn.addListener(listener);

      const cleanup = () => {
        conn.removeListener(listener);
        release();
      };

      cleanupMap.current.set(jobId, cleanup);
    }
  }, [processingJobIds, setJobStatus, startFallback, stopFallback]);

  // Re-apply terminal statuses after any jobs cache update to prevent
  // stale fetches from regressing completed/failed items back to pending.
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    return cache.subscribe((event) => {
      if (event.type !== "updated") {
        return;
      }
      const [head] = event.query.queryKey;
      if (head !== "jobs") {
        return;
      }
      applyTerminalStatuses();
    });
  }, [applyTerminalStatuses, queryClient]);

  // Cleanup all on unmount
  useEffect(() => {
    const map = cleanupMap.current;
    const fallbackTimers = fallbackTimersRef.current;
    const fallbackActive = fallbackActiveRef.current;
    const fallbackRuns = fallbackRunRef.current;
    const fallbackAttempts = fallbackAttemptsRef.current;
    const terminalStatuses = terminalStatusesRef.current;
    return () => {
      for (const cleanup of map.values()) {
        cleanup();
      }
      for (const timer of fallbackTimers.values()) {
        clearTimeout(timer);
      }
      map.clear();
      fallbackActive.clear();
      fallbackRuns.clear();
      fallbackTimers.clear();
      fallbackAttempts.clear();
      terminalStatuses.clear();
    };
  }, []);
};
