import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import type { ExtractInput, JobResponse } from "../../types";

import { useOCRBaseClient } from "../provider";
import { jobKeys } from "./use-jobs";

export const useExtract = (): UseMutationResult<
  JobResponse,
  Error,
  ExtractInput
> => {
  const client = useOCRBaseClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => client.extract(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
};
