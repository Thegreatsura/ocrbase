import { afterEach, describe, expect, test } from "bun:test";

import { extract, parse } from "./index";

const originalApiKey = process.env.OCRBASE_API_KEY;

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.OCRBASE_API_KEY;
    return;
  }

  process.env.OCRBASE_API_KEY = originalApiKey;
});

describe("simple API", () => {
  test("parse throws a clear error when OCRBASE_API_KEY is missing", async () => {
    delete process.env.OCRBASE_API_KEY;

    await expect(parse("./invoice.pdf")).rejects.toThrow("Missing API key");
  });

  test("extract throws a clear error when OCRBASE_API_KEY is missing", async () => {
    delete process.env.OCRBASE_API_KEY;

    await expect(
      extract("./invoice.pdf", {
        total: "number",
      })
    ).rejects.toThrow("Missing API key");
  });
});
