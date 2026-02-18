import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from "@tanstack/react-query";

import type {
  ExtractInput,
  ExtractOutput,
  InferSchemaOutput,
  OcrBaseSdk,
  OcrResult,
  ParseInput,
  ParseOutput,
} from "./index";

const DEFAULT_ERROR_MESSAGE = "OCR request failed.";

const hasMessage = (value: unknown): value is { message: unknown } =>
  typeof value === "object" && value !== null && "message" in value;

const hasValue = (value: unknown): value is { value: unknown } =>
  typeof value === "object" && value !== null && "value" in value;

const toError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  if (hasValue(error) && hasMessage(error.value)) {
    return new Error(String(error.value.message));
  }

  if (hasMessage(error)) {
    return new Error(String(error.message));
  }

  return new Error(DEFAULT_ERROR_MESSAGE);
};

const unwrapResult = <TData>(result: OcrResult<TData, unknown>): TData => {
  if (result.error !== null) {
    throw toError(result.error);
  }
  return result.data as TData;
};

export type UseOcrParseOptions = Omit<
  UseMutationOptions<ParseOutput, Error, ParseInput>,
  "mutationFn"
>;

export const useOcrParse = (
  ocr: Pick<OcrBaseSdk, "parse">,
  options?: UseOcrParseOptions
): UseMutationResult<ParseOutput, Error, ParseInput> =>
  useMutation({
    ...options,
    mutationFn: async (input: ParseInput) =>
      unwrapResult(await ocr.parse(input)),
  });

export type UseOcrExtractOptions<TSchema> = Omit<
  UseMutationOptions<
    ExtractOutput<InferSchemaOutput<TSchema>>,
    Error,
    ExtractInput<TSchema>
  >,
  "mutationFn"
>;

export const useOcrExtract = <TSchema>(
  ocr: Pick<OcrBaseSdk, "extract">,
  options?: UseOcrExtractOptions<TSchema>
): UseMutationResult<
  ExtractOutput<InferSchemaOutput<TSchema>>,
  Error,
  ExtractInput<TSchema>
> =>
  useMutation({
    ...options,
    mutationFn: async (input: ExtractInput<TSchema>) =>
      unwrapResult(await ocr.extract(input)),
  });
