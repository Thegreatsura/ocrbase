import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { FileUpload } from "@/components/file-upload";

const searchSchema = z.object({
  mode: z.enum(["parse", "extract"]).optional().default("parse"),
});

const AppPage = () => {
  const { mode } = Route.useSearch();

  const title = mode === "extract" ? "Extract Data" : "Parse Document";
  const description =
    mode === "extract"
      ? "Upload a document to extract structured data"
      : "Upload a document to extract text using OCR";

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <FileUpload mode={mode} title={title} description={description} />
    </div>
  );
};

export const Route = createFileRoute("/_authenticated/_layout/app")({
  component: AppPage,
  validateSearch: searchSchema,
});
