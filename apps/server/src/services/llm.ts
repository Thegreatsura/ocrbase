import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@ocrbase/env/server";
import { generateText } from "ai";

const openrouter = createOpenAI({
  apiKey: env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
});

const DEFAULT_MODEL = "google/gemini-2.5-flash";
const JSON_REPAIR_INPUT_LIMIT = 40_000;
const RESPONSE_PREVIEW_LIMIT = 240;

interface ProcessExtractionOptions {
  markdown: string;
  schema?: Record<string, unknown>;
  hints?: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
}

interface ExtractionResult {
  data: Record<string, unknown>;
  usage: LlmUsage;
  model: string;
}

interface GenerateSchemaOptions {
  markdown: string;
  hints?: string;
}

interface GeneratedSchema {
  name: string;
  description: string;
  jsonSchema: Record<string, unknown>;
}

type JsonValidator<T> = (value: unknown) => value is T;

export class LlmJsonParseError extends Error {
  readonly preview: string;

  constructor(message: string, rawResponse: string) {
    const preview = rawResponse
      .replaceAll(/\s+/g, " ")
      .trim()
      .slice(0, RESPONSE_PREVIEW_LIMIT);
    super(`${message}${preview ? ` (preview: ${preview})` : ""}`);
    this.name = "LlmJsonParseError";
    this.preview = preview;
  }
}

const emptyUsage = (): LlmUsage => ({
  completionTokens: 0,
  promptTokens: 0,
});

const toUsage = (result: {
  usage?: { inputTokens?: number; outputTokens?: number };
}): LlmUsage => ({
  completionTokens: result.usage?.outputTokens ?? 0,
  promptTokens: result.usage?.inputTokens ?? 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isGeneratedSchema = (value: unknown): value is GeneratedSchema =>
  isRecord(value) &&
  typeof value.name === "string" &&
  typeof value.description === "string" &&
  isRecord(value.jsonSchema);

const getRequiredTopLevelKeys = (
  schema?: Record<string, unknown>
): string[] => {
  if (!schema) {
    return [];
  }
  const { required } = schema;
  if (!Array.isArray(required)) {
    return [];
  }
  return required.filter((entry): entry is string => typeof entry === "string");
};

const buildExtractionValidator = (
  schema?: Record<string, unknown>
): JsonValidator<Record<string, unknown>> => {
  const requiredKeys = getRequiredTopLevelKeys(schema);

  return (value: unknown): value is Record<string, unknown> => {
    if (!isRecord(value)) {
      return false;
    }

    if (requiredKeys.length === 0) {
      return true;
    }

    return requiredKeys.every((key) => key in value);
  };
};

const findBalancedJsonSegments = (input: string): string[] => {
  const segments: string[] = [];
  const stack: string[] = [];
  let startIndex = -1;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === "\\") {
        escaping = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      if (stack.length === 0) {
        startIndex = index;
      }
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const lastOpen = stack.at(-1);
      if (!lastOpen) {
        continue;
      }

      const isValidClose =
        (char === "}" && lastOpen === "{") ||
        (char === "]" && lastOpen === "[");
      if (!isValidClose) {
        stack.length = 0;
        startIndex = -1;
        continue;
      }

      stack.pop();
      if (stack.length === 0 && startIndex !== -1) {
        segments.push(input.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }

  return segments;
};

const collectJsonCandidates = (text: string): string[] => {
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  const candidates: string[] = [];
  const seen = new Set<string>();

  const pushCandidate = (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  for (const match of text.matchAll(codeBlockRegex)) {
    if (match[1]) {
      pushCandidate(match[1]);
    }
  }

  const trimmed = text.trim();
  if (trimmed) {
    pushCandidate(trimmed);
    for (const segment of findBalancedJsonSegments(trimmed)) {
      pushCandidate(segment);
    }
  }

  return candidates;
};

const parseJsonFromText = <T>(text: string, validate?: JsonValidator<T>): T => {
  const validMatches: T[] = [];
  let parsedButInvalidShape = 0;

  for (const candidate of collectJsonCandidates(text)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (!validate) {
        validMatches.push(parsed as T);
        continue;
      }

      if (validate(parsed)) {
        validMatches.push(parsed);
      } else {
        parsedButInvalidShape += 1;
      }
    } catch {
      // Continue scanning other candidates.
    }
  }

  if (validMatches.length === 1) {
    const [onlyMatch] = validMatches;
    if (onlyMatch !== undefined) {
      return onlyMatch;
    }
  }

  if (validMatches.length > 1) {
    throw new LlmJsonParseError(
      "Ambiguous JSON response: multiple parseable JSON candidates found",
      text
    );
  }

  if (parsedButInvalidShape > 0) {
    throw new LlmJsonParseError(
      "Parsed JSON does not match expected shape",
      text
    );
  }

  throw new LlmJsonParseError(
    "JSON Parse error: Unable to parse JSON string",
    text
  );
};

const buildJsonRepairPrompt = (
  invalidResponse: string,
  expectedShape: string,
  schema?: Record<string, unknown>
): string => {
  const sections = [
    `The following response should be ${expectedShape}, but the JSON is invalid.`,
    "Rewrite it into valid JSON.",
    "Rules:",
    "- Return ONLY valid JSON.",
    "- Do not include markdown or explanation.",
    "- Preserve fields and values from the original response whenever possible.",
    "",
    "Invalid response:",
    "```",
    invalidResponse.slice(0, JSON_REPAIR_INPUT_LIMIT),
    "```",
  ];

  if (schema) {
    sections.push(
      "",
      "Target JSON schema (best effort):",
      "```json",
      JSON.stringify(schema, null, 2).slice(0, JSON_REPAIR_INPUT_LIMIT),
      "```"
    );
  }

  return sections.join("\n");
};

const parseJsonWithRepair = async <T>({
  expectedShape,
  responseText,
  schema,
  validate,
}: {
  expectedShape: string;
  responseText: string;
  schema?: Record<string, unknown>;
  validate?: JsonValidator<T>;
}): Promise<{ data: T; repairUsage: LlmUsage }> => {
  try {
    return {
      data: parseJsonFromText<T>(responseText, validate),
      repairUsage: emptyUsage(),
    };
  } catch {
    const repairResult = await generateText({
      model: openrouter(DEFAULT_MODEL),
      prompt: buildJsonRepairPrompt(responseText, expectedShape, schema),
      system:
        "You are a JSON repair tool. Output valid JSON only, with no markdown fences.",
    });

    try {
      return {
        data: parseJsonFromText<T>(repairResult.text, validate),
        repairUsage: toUsage(repairResult),
      };
    } catch {
      throw new LlmJsonParseError(
        "JSON Parse error: Unable to parse JSON string",
        repairResult.text
      );
    }
  }
};

export const checkLlmHealth = async (): Promise<boolean> => {
  if (!env.OPENROUTER_API_KEY) {
    return true;
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const llmService = {
  async generateSchema({
    markdown,
    hints,
  }: GenerateSchemaOptions): Promise<GeneratedSchema> {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    let systemPrompt = `You are a JSON schema generator. Analyze the provided document and generate a JSON schema that can be used to extract structured data from similar documents.

Return ONLY a valid JSON object with this exact structure:
{
  "name": "A descriptive name for this schema",
  "description": "Description of what this schema extracts",
  "jsonSchema": { ... the JSON Schema definition ... }
}

Do not include any markdown formatting or explanation. Just the JSON object.`;

    if (hints) {
      systemPrompt += `\n\nFocus on extracting: ${hints}`;
    }

    const result = await generateText({
      model: openrouter(DEFAULT_MODEL),
      prompt: markdown,
      system: systemPrompt,
    });

    const parsedResult = await parseJsonWithRepair<GeneratedSchema>({
      expectedShape:
        'a JSON object with keys "name" (string), "description" (string), and "jsonSchema" (object)',
      responseText: result.text,
      validate: isGeneratedSchema,
    });

    return parsedResult.data;
  },

  async processExtraction({
    markdown,
    schema,
    hints,
  }: ProcessExtractionOptions): Promise<ExtractionResult> {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    let systemPrompt =
      "You are a data extraction assistant. Extract structured data from the provided markdown content. Return ONLY valid JSON, no markdown formatting or explanation.";

    if (hints) {
      systemPrompt += `\n\nFocus on extracting: ${hints}`;
    }

    if (schema) {
      systemPrompt += `\n\nFollow this JSON schema:\n${JSON.stringify(schema, null, 2)}`;
    }

    const result = await generateText({
      model: openrouter(DEFAULT_MODEL),
      prompt: markdown,
      system: systemPrompt,
    });

    const validateExtraction = buildExtractionValidator(schema);
    const parsedResult = await parseJsonWithRepair<Record<string, unknown>>({
      expectedShape:
        "a JSON object with extracted fields from the provided markdown",
      responseText: result.text,
      schema,
      validate: validateExtraction,
    });

    const primaryUsage = toUsage(result);

    return {
      data: parsedResult.data,
      model: DEFAULT_MODEL,
      usage: {
        completionTokens:
          primaryUsage.completionTokens +
          parsedResult.repairUsage.completionTokens,
        promptTokens:
          primaryUsage.promptTokens + parsedResult.repairUsage.promptTokens,
      },
    };
  },
};
