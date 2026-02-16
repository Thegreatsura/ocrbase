import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useCallback, useState } from "react";

import { ApiKeysSheet } from "@/components/api-keys-sheet";
import { AppSidebar } from "@/components/app-sidebar";
import { ModelSelector } from "@/components/model-selector";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { jobsInfiniteQueryOptions } from "@/lib/queries";

const LayoutComponent = () => {
  const [apiKeysOpen, setApiKeysOpen] = useState(false);

  const handleOpenApiKeys = useCallback(() => {
    setApiKeysOpen(true);
  }, []);

  return (
    <SidebarProvider className="h-screen !min-h-0">
      <AppSidebar onOpenApiKeys={handleOpenApiKeys} />
      <SidebarInset className="flex h-screen flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center px-4">
          <ModelSelector />
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </SidebarInset>
      <ApiKeysSheet open={apiKeysOpen} onOpenChange={setApiKeysOpen} />
    </SidebarProvider>
  );
};

export const Route = createFileRoute("/_authenticated/_layout")({
  component: LayoutComponent,
  loader: ({ context }) =>
    context.queryClient.ensureInfiniteQueryData(jobsInfiniteQueryOptions()),
  ssr: false,
});
