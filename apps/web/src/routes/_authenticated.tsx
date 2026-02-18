import { usePostHog } from "@posthog/react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { authClient, useSession } from "@/lib/auth-client";

function AuthenticatedLayout() {
  const posthog = usePostHog();
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user && posthog) {
      posthog.identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
      });
    }
  }, [session?.user, posthog]);

  return <Outlet />;
}

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
  ssr: false,
});
