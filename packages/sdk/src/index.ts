import type { app } from "@ocrbase/server/app";

import { treaty } from "@elysiajs/eden";
import { z } from "zod";

const DEFAULT_BASE_URL = "https://api.ocrbase.dev";
const DEFAULT_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_PARSE_MODEL = "paddleocr-vl-1.5";
const DEFAULT_SCHEMA_NAME_PREFIX = "sdk-schema";
const DEFAULT_FILE_NAME = "document.pdf";
const PAGE_SEPARATOR = "\n\n---\n\n";

const EXTENSION_TO_MIME_TYPE: Record<string, string> = {
  bmp: "image/bmp",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};

type PrimitiveSchema = "boolean" | "date" | "integer" | "number" | "string";

export interface SimpleSchema {
  [key: string]: SimpleSchemaValue;
}

export type SimpleSchemaValue =
  | PrimitiveSchema
  | SimpleSchema
  | SimpleSchemaValue[];

type ArrayBufferLikeInput = ArrayBuffer | ArrayBufferView | SharedArrayBuffer;

export type DocumentInput =
  | ArrayBufferLikeInput
  | Blob
  | ReadableStream<Uint8Array>
  | string
  | URL;

export interface OcrBaseConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface ParseInput {
  file?: DocumentInput;
  fileName?: string;
  mimeType?: string;
  pages?: number[];
  timeoutMs?: number;
  url?: string | URL;
}

export interface ExtractInput<TSchema = unknown> {
  file?: DocumentInput;
  fileName?: string;
  keepSchema?: boolean;
  mimeType?: string;
  prompt?: string;
  schema: TSchema;
  schemaDescription?: string;
  schemaName?: string;
  timeoutMs?: number;
  url?: string | URL;
}

export interface ParseOutput {
  metadata: {
    jobId: string;
    model: string;
    pageCount: number;
    processingMs: number;
  };
  pages: {
    number: number;
    text: string;
  }[];
  text: string;
}

export interface ExtractOutput<TData = Record<string, unknown>> {
  confidence: number | null;
  data: TData;
  metadata: {
    jobId: string;
    model: string;
    pageCount: number;
    processingMs: number;
  };
}

export type OcrResult<TData, TError = unknown> =
  | { data: TData; error: null }
  | { data: null; error: TError };

type InferPrimitive<TPrimitive extends PrimitiveSchema> =
  TPrimitive extends "boolean"
    ? boolean
    : TPrimitive extends "date"
      ? string
      : TPrimitive extends "integer"
        ? number
        : TPrimitive extends "number"
          ? number
          : string;

type InferSimpleSchema<TValue> = TValue extends PrimitiveSchema
  ? InferPrimitive<TValue>
  : TValue extends (infer TItem)[]
    ? InferSimpleSchema<TItem>[]
    : TValue extends Record<string, unknown>
      ? { [K in keyof TValue]: InferSimpleSchema<TValue[K]> }
      : unknown;

type InferElysiaSchema<TSchema> = TSchema extends { static: infer TOutput }
  ? TOutput
  : never;

export type InferSchemaOutput<TSchema> = TSchema extends z.ZodTypeAny
  ? z.output<TSchema>
  : InferElysiaSchema<TSchema> extends never
    ? TSchema extends SimpleSchema
      ? InferSimpleSchema<TSchema>
      : Record<string, unknown>
    : InferElysiaSchema<TSchema>;

type App = typeof app;
type EdenClient = ReturnType<typeof treaty<App>>;
type EdenRawClient = ReturnType<typeof treaty>;

interface OcrJob {
  errorMessage?: string | null;
  id: string;
  jsonResult?: unknown;
  llmModel?: string | null;
  markdownResult?: string | null;
  pageCount?: number | null;
  processingTimeMs?: number | null;
  status: string;
}

interface OcrBaseError {
  status: number;
  value: Record<string, unknown>;
}

export interface OcrBaseSdk {
  client: EdenRawClient;
  extract: <TSchema>(
    input: ExtractInput<TSchema>
  ) => Promise<OcrResult<ExtractOutput<InferSchemaOutput<TSchema>>, unknown>>;
  parse: (input: ParseInput) => Promise<OcrResult<ParseOutput, unknown>>;
}

export type OcrBaseClient = OcrBaseSdk;

export interface GenerateTextOptions extends ParseInput, OcrBaseConfig {}

export interface GenerateObjectOptions<TSchema = unknown>
  extends ExtractInput<TSchema>, OcrBaseConfig {}

export interface GenerateObjectOutput<
  TData = Record<string, unknown>,
> extends ExtractOutput<TData> {
  object: TData;
}

export type ParseDocumentOptions = Omit<GenerateTextOptions, "file" | "url">;

export type ExtractDocumentOptions<TSchema = unknown> = Omit<
  GenerateObjectOptions<TSchema>,
  "file" | "url" | "schema"
>;

interface RealtimeConfig {
  timeoutMs: number;
}

interface NormalizedDocumentRequest {
  file?: File;
  url?: string;
}

const JSON_SCHEMA_HINT_KEYS = new Set([
  "$defs",
  "$schema",
  "additionalProperties",
  "allOf",
  "anyOf",
  "definitions",
  "items",
  "oneOf",
  "properties",
  "required",
]);

const SIMPLE_PRIMITIVE_TO_JSON_SCHEMA: Record<PrimitiveSchema, unknown> = {
  boolean: { type: "boolean" },
  date: { format: "date", type: "string" },
  integer: { type: "integer" },
  number: { type: "number" },
  string: { type: "string" },
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const fileUrlToPath = (value: URL): string => {
  let pathname = decodeURIComponent(value.pathname);

  if (/^\/[A-Za-z]:/.test(pathname)) {
    pathname = pathname.slice(1);
  }

  return pathname;
};

const getFileNameFromPath = (path: string): string => {
  const normalized = path.replaceAll("\\", "/");
  const parts = normalized.split("/");
  const last = parts.at(-1);
  if (!last || last.length === 0) {
    return DEFAULT_FILE_NAME;
  }
  return last;
};

const getMimeTypeFromFileName = (fileName: string): string => {
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  if (!extension) {
    return "application/octet-stream";
  }
  return EXTENSION_TO_MIME_TYPE[extension] ?? "application/octet-stream";
};

const getApiKeyFromEnv = (): string | undefined => {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }

  const value = process.env.OCRBASE_API_KEY;
  if (!value) {
    return undefined;
  }

  return value;
};

const normalizeBaseUrl = (baseUrl: string): string =>
  baseUrl.replace(/\/+$/, "");

const resolveConfig = (
  config: OcrBaseConfig
): {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
} => {
  const apiKey = config.apiKey ?? getApiKeyFromEnv();
  if (!apiKey) {
    throw new Error(
      "Missing API key. Pass `apiKey` to createOcrBase() or set OCRBASE_API_KEY."
    );
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL),
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
};

const toUint8Array = (input: ArrayBufferLikeInput): Uint8Array => {
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  if (
    typeof SharedArrayBuffer !== "undefined" &&
    input instanceof SharedArrayBuffer
  ) {
    return new Uint8Array(input);
  }

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }

  return new Uint8Array();
};

const toBlobSafeBytes = (
  input: ArrayBufferLikeInput
): Uint8Array<ArrayBuffer> => {
  const bytes = toUint8Array(input);
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
};

const toFileFromBinary = (
  input: ArrayBufferLikeInput,
  fileName?: string,
  mimeType?: string
): File => {
  const name = fileName ?? DEFAULT_FILE_NAME;
  return new File([toBlobSafeBytes(input)], name, {
    type: mimeType ?? getMimeTypeFromFileName(name),
  });
};

const toFileFromBlob = (
  blob: Blob,
  fileName?: string,
  mimeType?: string
): File => {
  if (blob instanceof File && !fileName && !mimeType) {
    return blob;
  }

  const name =
    fileName ?? (blob instanceof File ? blob.name : DEFAULT_FILE_NAME);
  return new File([blob], name, {
    type:
      mimeType ??
      (blob.type.length > 0 ? blob.type : getMimeTypeFromFileName(name)),
  });
};

const toFileFromStream = async (
  stream: ReadableStream<Uint8Array>,
  fileName?: string,
  mimeType?: string
): Promise<File> => {
  const buffer = await new Response(stream).arrayBuffer();
  return toFileFromBinary(buffer, fileName, mimeType);
};

const toFileFromLocalPath = async (
  path: string,
  fileName?: string,
  mimeType?: string
): Promise<File> => {
  const name = fileName ?? getFileNameFromPath(path);

  if (typeof Bun !== "undefined") {
    const bunFile = Bun.file(path);
    const exists = await bunFile.exists();
    if (!exists) {
      throw new Error(`File not found at path: ${path}`);
    }

    const arrayBuffer = await bunFile.arrayBuffer();
    const inferredType =
      bunFile.type.length > 0 ? bunFile.type : getMimeTypeFromFileName(name);

    return new File([arrayBuffer], name, {
      type: mimeType ?? inferredType,
    });
  }

  const fs = await import("node:fs/promises");
  const fileBuffer = await fs.readFile(path);
  return new File([fileBuffer], name, {
    type: mimeType ?? getMimeTypeFromFileName(name),
  });
};

const normalizeDocumentRequest = async ({
  file,
  fileName,
  mimeType,
  url,
}: {
  file?: DocumentInput;
  fileName?: string;
  mimeType?: string;
  url?: string | URL;
}): Promise<NormalizedDocumentRequest> => {
  if (file !== undefined) {
    if (typeof file === "string") {
      if (isHttpUrl(file)) {
        return { url: file };
      }

      return {
        file: await toFileFromLocalPath(file, fileName, mimeType),
      };
    }

    if (file instanceof URL) {
      if (file.protocol === "http:" || file.protocol === "https:") {
        return { url: file.toString() };
      }

      if (file.protocol === "file:") {
        return {
          file: await toFileFromLocalPath(
            fileUrlToPath(file),
            fileName,
            mimeType
          ),
        };
      }

      throw new Error(`Unsupported URL protocol: ${file.protocol}`);
    }

    if (file instanceof Blob) {
      return { file: toFileFromBlob(file, fileName, mimeType) };
    }

    if (file instanceof ReadableStream) {
      return { file: await toFileFromStream(file, fileName, mimeType) };
    }

    if (
      file instanceof ArrayBuffer ||
      (typeof SharedArrayBuffer !== "undefined" &&
        file instanceof SharedArrayBuffer) ||
      ArrayBuffer.isView(file)
    ) {
      return { file: toFileFromBinary(file, fileName, mimeType) };
    }
  }

  if (url) {
    const normalizedUrl = url instanceof URL ? url.toString() : url;
    if (!isHttpUrl(normalizedUrl)) {
      throw new Error("`url` must be a valid http(s) URL.");
    }
    return { url: normalizedUrl };
  }

  throw new Error("Provide either `file` or `url`.");
};

const normalizeRealtimeConfig = (
  input: Pick<ParseInput, "timeoutMs">,
  defaultTimeoutMs: number
): RealtimeConfig => ({
  timeoutMs:
    input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : defaultTimeoutMs,
});

const createSdkError = (
  status: number,
  value: Record<string, unknown>
): OcrBaseError => ({ status, value });

const toUnknownError = (error: unknown): OcrBaseError => {
  if (error instanceof Error) {
    return createSdkError(500, { message: error.message });
  }

  return createSdkError(500, {
    message: "Unexpected SDK error",
  });
};

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const readNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readNullableString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const readErrorMessage = (error: unknown): string | null => {
  if (typeof error === "object" && error !== null) {
    const maybeNestedValue = (error as { value?: unknown }).value;
    if (isPlainObject(maybeNestedValue)) {
      const nestedMessage = readNullableString(maybeNestedValue.message);
      if (nestedMessage) {
        return nestedMessage;
      }
    }

    const topLevelMessage = readNullableString(
      (error as { message?: unknown }).message
    );
    if (topLevelMessage && topLevelMessage !== "[object Object]") {
      return topLevelMessage;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return null;
};

const unwrapResultOrThrow = <TData>(
  result: OcrResult<TData, unknown>,
  fallbackMessage: string
): TData => {
  if (result.error === null) {
    return result.data as TData;
  }

  throw new Error(readErrorMessage(result.error) ?? fallbackMessage);
};

const splitMarkdownIntoPages = (markdown: string): ParseOutput["pages"] => {
  if (markdown.length === 0) {
    return [];
  }

  return markdown.split(PAGE_SEPARATOR).map((pageText, index) => ({
    number: index + 1,
    text: pageText,
  }));
};

const applyPageFilter = (
  pages: ParseOutput["pages"],
  selectedPages: number[] | undefined
): ParseOutput["pages"] => {
  if (!selectedPages || selectedPages.length === 0) {
    return pages;
  }

  const wanted = new Set(
    selectedPages.filter(
      (pageNumber): pageNumber is number =>
        Number.isInteger(pageNumber) && pageNumber > 0
    )
  );

  return pages.filter((page) => wanted.has(page.number));
};

const pagesToText = (pages: ParseOutput["pages"]): string =>
  pages.map((page) => page.text).join(PAGE_SEPARATOR);

const isPrimitiveSchema = (value: unknown): value is PrimitiveSchema =>
  typeof value === "string" &&
  (value === "boolean" ||
    value === "date" ||
    value === "integer" ||
    value === "number" ||
    value === "string");

const simpleSchemaNodeToJsonSchema = (node: unknown): unknown => {
  if (isPrimitiveSchema(node)) {
    return SIMPLE_PRIMITIVE_TO_JSON_SCHEMA[node];
  }

  if (Array.isArray(node)) {
    const first = node.at(0);
    return {
      items: first === undefined ? {} : simpleSchemaNodeToJsonSchema(first),
      type: "array",
    };
  }

  if (isPlainObject(node)) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(node)) {
      properties[key] = simpleSchemaNodeToJsonSchema(value);
      required.push(key);
    }

    return {
      additionalProperties: false,
      properties,
      required,
      type: "object",
    };
  }

  throw new Error(
    "Unsupported schema value. Use simple schema strings, arrays, objects, zod, Elysia t.*, or JSON Schema."
  );
};

const looksLikeJsonSchema = (
  schema: unknown
): schema is Record<string, unknown> => {
  if (!isPlainObject(schema)) {
    return false;
  }

  for (const key of JSON_SCHEMA_HINT_KEYS) {
    if (key in schema) {
      return true;
    }
  }

  return false;
};

const isZodSchema = (schema: unknown): schema is z.ZodTypeAny =>
  typeof schema === "object" &&
  schema !== null &&
  "_zod" in schema &&
  typeof (schema as { _zod: unknown })._zod === "object";

const schemaToJsonSchema = (schema: unknown): Record<string, unknown> => {
  if (isZodSchema(schema)) {
    const jsonSchema = z.toJSONSchema(schema);
    if (!isPlainObject(jsonSchema)) {
      throw new Error("Failed to convert Zod schema to JSON Schema.");
    }
    return jsonSchema;
  }

  if (looksLikeJsonSchema(schema)) {
    return schema;
  }

  if (isPlainObject(schema)) {
    const converted = simpleSchemaNodeToJsonSchema(schema);
    if (!isPlainObject(converted)) {
      throw new Error("Invalid simple schema.");
    }
    return converted;
  }

  throw new Error(
    "Unsupported schema type. Use simple object syntax, Elysia t.*, zod, or JSON Schema."
  );
};

const createRealtimeUrl = (
  baseUrl: string,
  apiKey: string,
  jobId: string
): string => {
  const url = new URL(`${baseUrl}/v1/realtime`);
  url.searchParams.set("job_id", jobId);
  url.searchParams.set("api_key", apiKey);
  return url.toString();
};

interface RealtimeCompletionPayload {
  jsonResult?: unknown;
  markdownResult?: string;
  processingTimeMs?: number;
}

const handleSseEvent = (
  eventType: string,
  data: string,
  jobId: string
): OcrResult<RealtimeCompletionPayload, unknown> | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  if (!isPlainObject(parsed)) {
    return null;
  }

  const messageData = isPlainObject(parsed.data) ? parsed.data : {};

  if (eventType === "completed") {
    return {
      data: {
        jsonResult: messageData.jsonResult,
        markdownResult:
          readNullableString(messageData.markdownResult) ?? undefined,
        processingTimeMs:
          typeof messageData.processingTimeMs === "number"
            ? messageData.processingTimeMs
            : undefined,
      },
      error: null,
    };
  }

  if (eventType === "error") {
    return {
      data: null,
      error: createSdkError(500, {
        jobId,
        message:
          readNullableString(messageData.error) ?? "Realtime job failed.",
      }),
    };
  }

  return null;
};

const readSseStream = async (
  body: ReadableStream<Uint8Array>,
  jobId: string
): Promise<OcrResult<RealtimeCompletionPayload, unknown>> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
        continue;
      }

      if (line.startsWith("data: ")) {
        const result = handleSseEvent(currentEvent, line.slice(6), jobId);
        if (result) {
          return result;
        }
        currentEvent = "";
        continue;
      }

      if (line === "" || line.startsWith(":")) {
        currentEvent = "";
      }
    }
  }

  return {
    data: null,
    error: createSdkError(500, {
      jobId,
      message: "Realtime SSE stream ended before job completed.",
    }),
  };
};

const waitForCompletedJob = async (
  baseUrl: string,
  apiKey: string,
  jobId: string,
  realtime: RealtimeConfig
): Promise<OcrResult<RealtimeCompletionPayload, unknown>> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), realtime.timeoutMs);

  try {
    const response = await fetch(createRealtimeUrl(baseUrl, apiKey, jobId), {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        data: null,
        error: createSdkError(response.status, {
          jobId,
          message: `Realtime SSE connection failed with status ${response.status}.`,
        }),
      };
    }

    const { body } = response;
    if (!body) {
      return {
        data: null,
        error: createSdkError(500, {
          jobId,
          message: "Realtime SSE response has no body.",
        }),
      };
    }

    return await readSseStream(body, jobId);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        data: null,
        error: createSdkError(408, {
          jobId,
          message: `Timed out after ${realtime.timeoutMs}ms while waiting for realtime completion.`,
        }),
      };
    }

    return {
      data: null,
      error: createSdkError(500, {
        jobId,
        message:
          error instanceof Error
            ? error.message
            : "Unexpected SSE streaming error.",
      }),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const getJobSnapshot = async (
  client: EdenClient,
  jobId: string
): Promise<OcrJob | null> => {
  try {
    const response = await client.v1.jobs({ id: jobId }).get();
    if (response.error !== null) {
      return null;
    }
    return response.data as unknown as OcrJob;
  } catch {
    return null;
  }
};

const cleanupTemporarySchema = async (
  client: EdenClient,
  schemaId: string
): Promise<void> => {
  try {
    await client.v1.schemas({ id: schemaId }).delete();
  } catch {
    // Intentionally ignore schema cleanup errors.
  }
};

const createTemporarySchemaAndSubmitExtract = async <TSchema>({
  client,
  input,
  jsonSchema,
  request,
}: {
  client: EdenClient;
  input: ExtractInput<TSchema>;
  jsonSchema: Record<string, unknown>;
  request: NormalizedDocumentRequest;
}): Promise<OcrResult<{ jobId: string; schemaId: string }, OcrBaseError>> => {
  const createdSchema = await client.v1.schemas.post({
    description:
      input.schemaDescription ??
      "Temporary schema created by ocrbase SDK for extraction.",
    jsonSchema,
    name: input.schemaName ?? `${DEFAULT_SCHEMA_NAME_PREFIX}-${Date.now()}`,
  });

  if (createdSchema.error !== null) {
    return { data: null, error: createdSchema.error };
  }

  const schemaId = readString(
    (createdSchema.data as Record<string, unknown>).id
  );
  if (!schemaId) {
    return {
      data: null,
      error: createSdkError(500, {
        message:
          "Schema creation succeeded but response did not include schema id.",
      }),
    };
  }

  const submitted = await client.v1.extract.post({
    ...request,
    hints: input.prompt,
    schemaId,
  });

  if (submitted.error !== null) {
    return { data: null, error: submitted.error };
  }

  const jobId = readString((submitted.data as Record<string, unknown>).id);
  if (!jobId) {
    return {
      data: null,
      error: createSdkError(500, {
        message:
          "Extract request succeeded but response did not include a job id.",
      }),
    };
  }

  return { data: { jobId, schemaId }, error: null };
};

export const createOcrBase = (config: OcrBaseConfig = {}): OcrBaseSdk => {
  const resolved = resolveConfig(config);

  const client = treaty<App>(resolved.baseUrl, {
    headers: {
      Authorization: `Bearer ${resolved.apiKey}`,
    },
  });

  const parse = async (
    input: ParseInput
  ): Promise<OcrResult<ParseOutput, unknown>> => {
    const realtime = normalizeRealtimeConfig(input, resolved.timeoutMs);

    let request: NormalizedDocumentRequest;
    try {
      request = await normalizeDocumentRequest({
        file: input.file,
        fileName: input.fileName,
        mimeType: input.mimeType,
        url: input.url,
      });
    } catch (error) {
      return { data: null, error: toUnknownError(error) };
    }

    try {
      const submitted = await client.v1.parse.post(request);
      if (submitted.error !== null) {
        return { data: null, error: submitted.error };
      }

      const jobId = readString((submitted.data as Record<string, unknown>).id);
      if (!jobId) {
        return {
          data: null,
          error: createSdkError(500, {
            message:
              "Parse request succeeded but response did not include a job id.",
          }),
        };
      }

      const completed = await waitForCompletedJob(
        resolved.baseUrl,
        resolved.apiKey,
        jobId,
        realtime
      );
      if (completed.error !== null) {
        return { data: null, error: completed.error };
      }
      if (completed.data === null) {
        return {
          data: null,
          error: createSdkError(500, {
            message: "Parse job completed with empty payload.",
          }),
        };
      }

      const snapshot = await getJobSnapshot(client, jobId);
      const markdown =
        completed.data.markdownResult ?? snapshot?.markdownResult ?? "";
      const allPages = splitMarkdownIntoPages(markdown);
      const selectedPages = applyPageFilter(allPages, input.pages);
      const pageCount =
        input.pages && input.pages.length > 0
          ? selectedPages.length
          : readNumber(snapshot?.pageCount, selectedPages.length);

      return {
        data: {
          metadata: {
            jobId,
            model: DEFAULT_PARSE_MODEL,
            pageCount,
            processingMs: readNumber(
              completed.data.processingTimeMs ?? snapshot?.processingTimeMs,
              0
            ),
          },
          pages: selectedPages,
          text: pagesToText(selectedPages),
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error: toUnknownError(error) };
    }
  };

  const extract = async <TSchema>(
    input: ExtractInput<TSchema>
  ): Promise<OcrResult<ExtractOutput<InferSchemaOutput<TSchema>>, unknown>> => {
    const realtime = normalizeRealtimeConfig(input, resolved.timeoutMs);

    let request: NormalizedDocumentRequest;
    let jsonSchema: Record<string, unknown>;

    try {
      request = await normalizeDocumentRequest({
        file: input.file,
        fileName: input.fileName,
        mimeType: input.mimeType,
        url: input.url,
      });
      jsonSchema = schemaToJsonSchema(input.schema);
    } catch (error) {
      return { data: null, error: toUnknownError(error) };
    }

    const shouldDeleteTemporarySchema = input.keepSchema !== true;
    let schemaId: string | null = null;

    try {
      const submission = await createTemporarySchemaAndSubmitExtract({
        client,
        input,
        jsonSchema,
        request,
      });
      if (submission.error !== null) {
        return { data: null, error: submission.error };
      }

      const { jobId } = submission.data;
      ({ schemaId } = submission.data);

      const completed = await waitForCompletedJob(
        resolved.baseUrl,
        resolved.apiKey,
        jobId,
        realtime
      );
      if (completed.error !== null || completed.data === null) {
        return {
          data: null,
          error:
            completed.error ??
            createSdkError(500, {
              message: "Extract job completed with empty payload.",
            }),
        };
      }

      const snapshot = await getJobSnapshot(client, jobId);

      return {
        data: {
          confidence: null,
          data:
            ((completed.data.jsonResult ??
              snapshot?.jsonResult) as InferSchemaOutput<TSchema>) ??
            ({} as InferSchemaOutput<TSchema>),
          metadata: {
            jobId,
            model: readNullableString(snapshot?.llmModel) ?? "unknown",
            pageCount: readNumber(snapshot?.pageCount, 0),
            processingMs: readNumber(
              completed.data.processingTimeMs ?? snapshot?.processingTimeMs,
              0
            ),
          },
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error: toUnknownError(error) };
    } finally {
      if (shouldDeleteTemporarySchema && schemaId) {
        await cleanupTemporarySchema(client, schemaId);
      }
    }
  };

  return {
    client: client as unknown as EdenRawClient,
    extract,
    parse,
  };
};

export const generateText = async (
  options: GenerateTextOptions
): Promise<ParseOutput> => {
  const { apiKey, baseUrl, file, fileName, mimeType, pages, timeoutMs, url } =
    options;

  const ocr = createOcrBase({
    apiKey,
    baseUrl,
    timeoutMs,
  });

  const result = await ocr.parse({
    file,
    fileName,
    mimeType,
    pages,
    timeoutMs,
    url,
  });

  return unwrapResultOrThrow(result, "OCR parse request failed.");
};

export const generateObject = async <TSchema>(
  options: GenerateObjectOptions<TSchema>
): Promise<GenerateObjectOutput<InferSchemaOutput<TSchema>>> => {
  const {
    apiKey,
    baseUrl,
    file,
    fileName,
    keepSchema,
    mimeType,
    prompt,
    schema,
    schemaDescription,
    schemaName,
    timeoutMs,
    url,
  } = options;

  const ocr = createOcrBase({
    apiKey,
    baseUrl,
    timeoutMs,
  });

  const result = await ocr.extract({
    file,
    fileName,
    keepSchema,
    mimeType,
    prompt,
    schema,
    schemaDescription,
    schemaName,
    timeoutMs,
    url,
  });

  const extracted = unwrapResultOrThrow(
    result,
    "OCR extraction request failed."
  );

  return {
    ...extracted,
    object: extracted.data,
  };
};

export const parseDocument = (
  file: DocumentInput,
  options: ParseDocumentOptions = {}
): Promise<ParseOutput> => generateText({ ...options, file });

export const extractDocument = <TSchema>(
  file: DocumentInput,
  schema: TSchema,
  options: ExtractDocumentOptions<TSchema> = {}
): Promise<GenerateObjectOutput<InferSchemaOutput<TSchema>>> =>
  generateObject({ ...options, file, schema });

export const parse = parseDocument;
export const extract = extractDocument;
