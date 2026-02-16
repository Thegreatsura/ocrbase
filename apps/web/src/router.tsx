import type { QueryClient } from "@tanstack/react-query";

import { createRouter } from "@tanstack/react-router";

import { queryClient } from "@/lib/query-client";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

export interface RouterContext {
  queryClient: QueryClient;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    context: { queryClient },
    defaultPreloadStaleTime: 0,

    routeTree,
    scrollRestoration: true,
  });

  return router;
};
