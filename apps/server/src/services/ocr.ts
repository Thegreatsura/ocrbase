import { env } from "@ocrbase/env/server";
import { PaddleOCRClient } from "@ocrbase/paddleocr-vl-ts";

export interface ParseResult {
  markdown: string;
  pageCount: number;
}

const ocrClient = new PaddleOCRClient({
  layoutUrl: env.PADDLE_OCR_URL,
  timeout: env.PADDLE_OCR_TIMEOUT_MS,
});

const getFileType = (mimeType: string): 0 | 1 => {
  if (mimeType === "application/pdf") {
    return 0 as const;
  }
  return 1 as const;
};

export const parseDocument = async (
  buffer: Buffer,
  mimeType: string
): Promise<ParseResult> => {
  const base64 = buffer.toString("base64");
  const fileType = getFileType(mimeType);

  const result = await ocrClient.parseDocument(base64, { fileType });
  const markdown = PaddleOCRClient.combineMarkdown(result);
  const pageCount = PaddleOCRClient.getPageCount(result);

  return { markdown, pageCount };
};

export const checkOcrHealth = (): Promise<boolean> => ocrClient.checkHealth();

export { ocrClient };
