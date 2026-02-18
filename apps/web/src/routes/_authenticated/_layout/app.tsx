import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { resolveActiveOrganizationSlug } from "@/lib/organization";

const searchSchema = z.object({
  mode: z.enum(["parse", "extract"]).optional(),
});

export const Route = createFileRoute("/_authenticated/_layout/app")({
  beforeLoad: async ({ search }) => {
    const organizationSlug = await resolveActiveOrganizationSlug();
    if (!organizationSlug) {
      throw redirect({ to: "/login" });
    }

    throw redirect({
      params: { orgSlug: organizationSlug },
      search,
      to: "/$orgSlug",
    });
  },
  component: () => null,
  validateSearch: searchSchema,
});
