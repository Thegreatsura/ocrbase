import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import type { JobResponse, ParseInput } from "../../types";

import { useOCRBaseClient } from "../provider";
import { jobKeys } from "./use-jobs";

export const useParse = (): UseMutationResult<
  JobResponse,
  Error,
  ParseInput
> => {
  const client = useOCRBaseClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => client.parse(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
};
