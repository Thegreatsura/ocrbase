import type { JobUpdateMessage } from "@ocrbase/db/lib/enums";
import type { InfiniteData } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import type { JobListItem } from "@/lib/queries";

import { getJobConnection } from "@/lib/websocket";

interface JobsPageResponse {
  data: JobListItem[];
  pagination: {
    currentPage: number;
    hasNextPage: boolean;
    totalCount: number;
  };
}

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
 * updating only the sidebar's `["jobs", *]` list cache as status changes.
 *
 * Individual job query invalidation is left to `useJobRealtime` to
 * avoid double-invalidation.
 */
export const useProcessingJobsRealtime = (processingJobIds: string[]) => {
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const cleanupMap = useRef<Map<string, () => void>>(new Map());
  const terminalStatusesRef = useRef<
    Map<string, Extract<JobListItem["status"], "completed" | "failed">>
  >(new Map());
  const applyingTerminalStatusesRef = useRef(false);

  const applyTerminalStatuses = useCallback(() => {
    const qc = queryClientRef.current;
    const terminalStatuses = terminalStatusesRef.current;

    if (terminalStatuses.size === 0 || applyingTerminalStatusesRef.current) {
      return;
    }

    applyingTerminalStatusesRef.current = true;
    try {
      const jobsQueries = qc.getQueryCache().findAll({ queryKey: ["jobs"] });
      for (const jobsQuery of jobsQueries) {
        const current = jobsQuery.state.data as
          | InfiniteData<JobsPageResponse>
          | undefined;
        if (!current) {
          continue;
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
          continue;
        }

        qc.setQueryData<InfiniteData<JobsPageResponse>>(jobsQuery.queryKey, {
          ...current,
          pages,
        });
      }
    } finally {
      applyingTerminalStatusesRef.current = false;
    }
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

      queryClientRef.current.setQueriesData<InfiniteData<JobsPageResponse>>(
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
                job.id === jobId ? { ...job, status: resolvedStatus } : job
              ),
            })),
          };
        }
      );
    },
    []
  );

  useEffect(() => {
    const currentIds = new Set(processingJobIds);

    // Tear down connections for jobs no longer processing
    for (const [id, cleanup] of cleanupMap.current) {
      if (!currentIds.has(id)) {
        cleanup();
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
        if (msg.type === "error" && msg.data?.status !== "failed") {
          // Non-job WS/auth error — do nothing.
          // WebSocket reconnection is handled by websocket.ts with exponential backoff.
          debugJobsRealtime(jobId, "non_job_ws_error", {
            error: msg.data?.error,
          });
          return;
        }

        let nextStatus: JobListItem["status"] | undefined;
        if (msg.type === "status") {
          nextStatus = msg.data?.status;
        }
        if (msg.type === "completed") {
          nextStatus = "completed";
        }
        if (msg.type === "error") {
          nextStatus = "failed";
        }

        if (!nextStatus) {
          return;
        }
        setJobStatus(jobId, nextStatus);
      };

      conn.addListener(listener);

      const cleanup = () => {
        conn.removeListener(listener);
        release();
      };

      cleanupMap.current.set(jobId, cleanup);
    }
  }, [processingJobIds, setJobStatus]);

  // Re-apply terminal statuses after any jobs cache update to prevent
  // stale fetches from regressing completed/failed items back to pending.
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    return cache.subscribe((event) => {
      if (event.type !== "updated") {
        return;
      }
      if (applyingTerminalStatusesRef.current) {
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
    const terminalStatuses = terminalStatusesRef.current;
    return () => {
      for (const cleanup of map.values()) {
        cleanup();
      }
      map.clear();
      terminalStatuses.clear();
    };
  }, []);
};
