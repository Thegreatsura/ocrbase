import { useQuery } from "@tanstack/react-query";

import { jobQueryOptions } from "@/lib/queries";

import { useJobRealtime } from "./use-job-realtime";

export const useJob = (jobId: string) => {
  const query = useQuery(jobQueryOptions(jobId));
  useJobRealtime(jobId, query.data?.status);
  return query;
};
