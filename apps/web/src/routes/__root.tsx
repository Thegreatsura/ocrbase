import { PostHogProvider } from "@posthog/react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";

import type { RouterContext } from "@/router";

import { queryClient } from "@/lib/query-client";
import appCss from "@/styles.css?url";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST;

const AppContent = () => (
  <RootProvider>
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  </RootProvider>
);

const RootComponent = () => (
  <html lang="en" suppressHydrationWarning>
    <head>
      <HeadContent />
    </head>
    <body className="min-h-screen bg-background text-foreground antialiased pb-[env(safe-area-inset-bottom)]">
      {posthogKey ? (
        <PostHogProvider
          apiKey={posthogKey}
          options={{
            api_host: posthogHost,
            capture_pageleave: true,
            capture_pageview: true,
          }}
        >
          <AppContent />
        </PostHogProvider>
      ) : (
        <AppContent />
      )}
      <Scripts />
    </body>
  </html>
);

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  head: () => ({
    links: [{ href: appCss, rel: "stylesheet" }],
    meta: [
      { charSet: "utf8" },
      {
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
        name: "viewport",
      },
      { title: "ocrbase" },
      {
        content: "#ffffff",
        media: "(prefers-color-scheme: light)",
        name: "theme-color",
      },
      {
        content: "#212121",
        media: "(prefers-color-scheme: dark)",
        name: "theme-color",
      },
    ],
  }),
});
