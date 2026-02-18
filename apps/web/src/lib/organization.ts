import { authClient } from "@/lib/auth-client";

interface OrganizationSummary {
  id: string;
  slug: string | null;
}

const isOrganizationSummary = (
  value: unknown
): value is OrganizationSummary => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { id?: unknown; slug?: unknown };
  const validId = typeof candidate.id === "string" && candidate.id.length > 0;
  const validSlug =
    candidate.slug === null ||
    (typeof candidate.slug === "string" && candidate.slug.length > 0);

  return validId && validSlug;
};

const parseOrganizationList = (input: unknown): OrganizationSummary[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter(isOrganizationSummary);
};

export const resolveActiveOrganizationSlug = async (): Promise<
  string | null
> => {
  const activeResponse = await authClient.organization.getFullOrganization();
  const activeOrganization = activeResponse.data;
  if (activeOrganization?.slug) {
    return activeOrganization.slug;
  }

  const organizationsResponse = await authClient.organization.list();
  const organizations = parseOrganizationList(organizationsResponse.data);
  if (organizations.length === 0) {
    return null;
  }

  const activeOrganizationById = activeOrganization?.id
    ? organizations.find(
        (organization) => organization.id === activeOrganization.id
      )
    : null;

  const fallbackOrganization = activeOrganizationById?.slug
    ? activeOrganizationById
    : organizations.find((organization) => organization.slug);

  if (!fallbackOrganization?.slug) {
    return null;
  }

  await authClient.organization.setActive({
    organizationId: fallbackOrganization.id,
  });

  return fallbackOrganization.slug;
};
