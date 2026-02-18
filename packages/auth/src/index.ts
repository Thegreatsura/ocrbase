import { db } from "@ocrbase/db";
import { createId } from "@ocrbase/db/lib/ids";
import * as schema from "@ocrbase/db/schema/auth";
import { env } from "@ocrbase/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";

const stripDiacritics = (value: string): string =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

const toSlug = (value: string): string =>
  stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const cleanNameToken = (value: string): string =>
  value.replace(/[^a-zA-Z0-9'-]/g, "");

const capitalizeWord = (value: string): string =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("-");

const getUserNameParts = (
  name: string,
  email: string,
  userId: string
): { firstName: string; lastName: string } => {
  const nameParts = name
    .trim()
    .split(/\s+/)
    .map(cleanNameToken)
    .filter(Boolean);

  const emailLocalPart = email.split("@")[0] ?? "";
  const emailParts = emailLocalPart
    .split(/[._-]+/)
    .map(cleanNameToken)
    .filter(Boolean);

  const firstName = capitalizeWord(nameParts[0] ?? emailParts[0] ?? "user");
  const lastNamePart =
    nameParts.length > 1
      ? nameParts[nameParts.length - 1]
      : emailParts.length > 1
        ? emailParts[emailParts.length - 1]
        : userId.slice(-6);
  const lastName = capitalizeWord(lastNamePart ?? userId.slice(-6));

  return { firstName, lastName };
};

const getUniqueOrganizationSlug = async (baseSlug: string): Promise<string> => {
  let index = 1;
  let slugCandidate = baseSlug;

  while (true) {
    const [existingOrg] = await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.slug, slugCandidate))
      .limit(1);

    if (!existingOrg) {
      return slugCandidate;
    }

    index += 1;
    slugCandidate = `${baseSlug}-${index}`;
  }
};

const buildSocialProviders = () => {
  const providers: Record<string, { clientId: string; clientSecret: string }> =
    {};
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
  }
  return providers;
};

export const auth = betterAuth({
  basePath: "/v1/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  trustedOrigins: env.CORS_ORIGINS,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: buildSocialProviders(),
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: env.NODE_ENV === "production",
      httpOnly: true,
    },
    generateId: ({ model }: { model: string }) => {
      const modelMap: Record<string, Parameters<typeof createId>[0]> = {
        account: "account",
        invitation: "invitation",
        member: "member",
        organization: "organization",
        session: "session",
        user: "user",
        verification: "verification",
      };
      const prefix = modelMap[model];
      if (!prefix) {
        throw new Error(`Unknown model for ID generation: ${model}`);
      }
      return createId(prefix);
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const orgId = createId("organization");
            const { firstName, lastName } = getUserNameParts(
              user.name,
              user.email,
              user.id
            );
            const organizationName = `${firstName} ${lastName}'s organization`;
            const baseSlug = toSlug(`${firstName}-${lastName}`) || "user";
            const slug = await getUniqueOrganizationSlug(baseSlug);

            await db.insert(schema.organization).values({
              id: orgId,
              name: organizationName,
              slug,
            });
            await db.insert(schema.member).values({
              id: createId("member"),
              organizationId: orgId,
              userId: user.id,
              role: "owner",
            });
          } catch {
            await db.delete(schema.user).where(eq(schema.user.id, user.id));
            throw new Error("Failed to create default organization");
          }
        },
      },
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
    }),
  ],
});
