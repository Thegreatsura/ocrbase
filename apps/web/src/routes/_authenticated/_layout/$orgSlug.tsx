import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { FileUpload } from "@/components/file-upload";
import { authClient } from "@/lib/auth-client";
import { resolveActiveOrganizationSlug } from "@/lib/organization";

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

export const Route = createFileRoute("/_authenticated/_layout/$orgSlug")({
  beforeLoad: async ({ params }) => {
    const setActiveResult = await authClient.organization.setActive({
      organizationSlug: params.orgSlug,
    });

    if (setActiveResult.error) {
      const fallbackSlug = await resolveActiveOrganizationSlug();

      if (fallbackSlug && fallbackSlug !== params.orgSlug) {
        throw redirect({
          params: { orgSlug: fallbackSlug },
          to: "/$orgSlug",
        });
      }

      throw redirect({ to: "/app" });
    }
  },
  component: AppPage,
  validateSearch: searchSchema,
});
