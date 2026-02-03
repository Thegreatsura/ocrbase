import type { Session, User } from "better-auth/types";

import { auth } from "@ocrbase/auth";
import { db } from "@ocrbase/db";
import { member, organization, user } from "@ocrbase/db/schema/auth";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";

import type { WideEventContext } from "@/lib/wide-event";

import { type ApiKeyInfo, validateApiKey } from "@/lib/api-key";

type Organization = Awaited<ReturnType<typeof auth.api.getFullOrganization>>;

export const authPlugin = new Elysia({ name: "auth" }).derive(
  { as: "global" },
  // eslint-disable-next-line complexity
  async ({
    request,
    wideEvent,
  }: {
    request: Request;
    wideEvent?: WideEventContext;
  }): Promise<{
    apiKey: ApiKeyInfo | null;
    organization: Organization | null;
    session: Session | null;
    user: User | null;
  }> => {
    const authHeader = request.headers.get("authorization");
    const hasApiKeyToken =
      authHeader?.toLowerCase().startsWith("bearer sk_") ?? false;

    // API key authentication
    if (hasApiKeyToken) {
      const apiKey = await validateApiKey(authHeader);
      if (!apiKey) {
        return {
          apiKey: null,
          organization: null,
          session: null,
          user: null,
        };
      }

      const [dbUser] = await db
        .select()
        .from(user)
        .where(eq(user.id, apiKey.userId));

      if (!dbUser) {
        return { apiKey: null, organization: null, session: null, user: null };
      }

      // Find organization
      let [dbOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.id, apiKey.organizationId));

      if (!dbOrg) {
        const [membership] = await db
          .select({ org: organization })
          .from(member)
          .innerJoin(organization, eq(member.organizationId, organization.id))
          .where(eq(member.userId, apiKey.userId))
          .limit(1);
        dbOrg = membership?.org;
      }

      wideEvent?.setUser({ id: dbUser.id });
      if (dbOrg) {
        wideEvent?.setOrganization({ id: dbOrg.id, name: dbOrg.name });
      }

      return {
        apiKey,
        organization: dbOrg
          ? {
              createdAt: dbOrg.createdAt,
              id: dbOrg.id,
              invitations: [],
              logo: dbOrg.logo,
              members: [],
              metadata: dbOrg.metadata,
              name: dbOrg.name,
              slug: dbOrg.slug ?? dbOrg.id,
            }
          : null,
        session: {
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86_400_000),
          id: `apikey:${apiKey.id}`,
          ipAddress: null,
          token: "",
          updatedAt: new Date(),
          userAgent: request.headers.get("user-agent"),
          userId: dbUser.id,
        },
        user: dbUser,
      };
    }

    // Session authentication
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return { apiKey: null, organization: null, session: null, user: null };
    }

    wideEvent?.setUser({ id: session.user.id });

    // Resolve organization
    let activeOrg = await auth.api.getFullOrganization({
      headers: request.headers,
    });

    const orgId = request.headers.get("x-organization-id");
    if (!activeOrg && orgId) {
      activeOrg = await auth.api.getFullOrganization({
        headers: request.headers,
        query: { organizationId: orgId },
      });
    }

    if (!activeOrg) {
      const [membership] = await db
        .select({ organization: organization })
        .from(member)
        .innerJoin(organization, eq(member.organizationId, organization.id))
        .where(eq(member.userId, session.user.id))
        .limit(1);

      if (membership) {
        activeOrg = await auth.api.getFullOrganization({
          headers: request.headers,
          query: { organizationId: membership.organization.id },
        });
      }
    }

    if (activeOrg) {
      wideEvent?.setOrganization({ id: activeOrg.id, name: activeOrg.name });
    }

    return {
      apiKey: null,
      organization: activeOrg,
      session: session.session,
      user: session.user,
    };
  }
);

export const requireAuth = new Elysia({ name: "requireAuth" })
  .use(authPlugin)
  .onBeforeHandle({ as: "scoped" }, ({ set, user }) => {
    if (!user) {
      set.status = 401;
      return { message: "Unauthorized" };
    }
  });
