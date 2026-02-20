# `ocrbase-sdk`

TypeScript SDK for ocrbase powered by Eden Treaty.

This SDK waits for job completion over Server-Sent Events (no polling).

## Install

```bash
bun add ocrbase-sdk
```

```bash
npm install ocrbase-sdk
```

## Quick start

```ts
import { parse } from "ocrbase-sdk";

const { text } = await parse("./invoice.pdf");
console.log(text);
```

`parse()` and `extract()` automatically read `OCRBASE_API_KEY` from
`process.env` when `apiKey` is not provided.

## Structured extraction

```ts
import { extract } from "ocrbase-sdk";

const { object } = await extract("./invoice.pdf", {
  vendor: "string",
  total: "number",
  date: "date",
});

console.log(object.vendor);
```

## Advanced client API

Use `createOcrBase()` when you want reusable client instances and `{ data, error }`
results instead of thrown errors.

```ts
import { createOcrBase } from "ocrbase-sdk";

const ocr = createOcrBase();
const result = await ocr.parse({ file: "./invoice.pdf" });

if (result.error) throw result.error;
console.log(result.data.text);
```

## Input types

`file` supports:

- `File` / `Blob` / `Bun.file(...)`
- `Buffer`, `ArrayBuffer`, typed arrays
- `ReadableStream<Uint8Array>`
- local file path string (for example `"./invoice.pdf"`)
- remote URL string (for example `"https://example.com/invoice.pdf"`)

```ts
await parse("https://example.com/report.pdf");
```

## Schema adapters

`extract()` accepts:

- Simple schema objects (`"string"`, `"number"`, `"boolean"`, `"integer"`, `"date"`)
- Elysia `t.*` / TypeBox schema objects
- Zod schemas
- Raw JSON Schema

## React Query hooks

```ts
import { createOcrBase } from "ocrbase-sdk";
import { useOcrExtract, useOcrParse } from "ocrbase-sdk/react";

const ocr = createOcrBase({ apiKey: process.env.NEXT_PUBLIC_API_KEY! });

const parseMutation = useOcrParse(ocr);
const extractMutation = useOcrExtract(ocr);
```
