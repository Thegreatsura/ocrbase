import { db } from "@ocrbase/db";
import { createId } from "@ocrbase/db/lib/ids";
import * as schema from "@ocrbase/db/schema/auth";
import { env } from "@ocrbase/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";

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
            await db.insert(schema.organization).values({
              id: orgId,
              name: "Personal",
              slug: `personal-${user.id}`,
            });
            await db.insert(schema.member).values({
              id: createId("member"),
              organizationId: orgId,
              userId: user.id,
              role: "owner",
            });
          } catch {
            await db.delete(schema.user).where(eq(schema.user.id, user.id));
            throw new Error("Failed to create personal organization");
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
