import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Key, LogOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useProcessingJobsRealtime } from "@/hooks/use-processing-jobs-realtime";
import { authClient, signOut, useSession } from "@/lib/auth-client";
import { isJobProcessing, jobsInfiniteQueryOptions } from "@/lib/queries";

export const AppSidebar = ({
  onOpenApiKeys,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  onOpenApiKeys?: () => void;
}) => {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const { data: session } = useSession();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const [historyOpen, setHistoryOpen] = useState(true);

  const {
    data: jobsData,
    isLoading: isLoadingJobs,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    jobsInfiniteQueryOptions(session?.session.activeOrganizationId ?? "active")
  );

  const jobs = useMemo(
    () => jobsData?.pages.flatMap((page) => page.data) ?? [],
    [jobsData]
  );

  const processingJobIds = useMemo(
    () =>
      jobs.filter((job) => isJobProcessing(job.status)).map((job) => job.id),
    [jobs]
  );

  useProcessingJobsRealtime(processingJobIds);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Determine active route
  const currentPath = routerState.location.pathname;
  const currentSearch = routerState.location.search as { mode?: string };
  const organizationPath = activeOrganization?.slug
    ? `/${activeOrganization.slug}`
    : null;
  const isPlaygroundPath =
    currentPath === "/app" || currentPath === organizationPath;
  const isParseActive =
    isPlaygroundPath && (!currentSearch.mode || currentSearch.mode === "parse");
  const isExtractActive = isPlaygroundPath && currentSearch.mode === "extract";

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate({ to: "/login" });
  }, [navigate]);

  const toggleHistory = useCallback(() => {
    setHistoryOpen((prev) => !prev);
  }, []);

  const handleHistoryKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleHistory();
      }
    },
    [toggleHistory]
  );

  const renderJobs = () => {
    if (isLoadingJobs) {
      return (
        <SidebarMenuItem>
          <SidebarMenuButton disabled>
            <Spinner className="size-4" />
            <span>Loading…</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    if (jobs.length === 0) {
      return (
        <SidebarMenuItem>
          <SidebarMenuButton disabled>
            <span className="text-muted-foreground">No jobs yet</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return jobs.map((job) => {
      const jobPath =
        job.type === "parse" ? `/parse/${job.id}` : `/extract/${job.id}`;
      const isJobActive = currentPath === jobPath;
      const processing = isJobProcessing(job.status);

      return (
        <SidebarMenuItem key={job.id}>
          <Link
            to={job.type === "parse" ? "/parse/$jobId" : "/extract/$jobId"}
            params={{ jobId: job.id }}
          >
            <SidebarMenuButton isActive={isJobActive}>
              {processing && <Spinner className="size-3 shrink-0" />}
              <span className="truncate">{job.fileName || job.id}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      );
    });
  };

  return (
    <Sidebar collapsible="none" {...props}>
      <SidebarHeader className="p-4">
        <Link to="/app">
          <span className="text-xl font-medium">ocrbase</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Methods</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Link to="/app" search={{ mode: "parse" }}>
                  <SidebarMenuButton isActive={isParseActive}>
                    <span>Parse</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link to="/app" search={{ mode: "extract" }}>
                  <SidebarMenuButton isActive={isExtractActive}>
                    <span>Extract</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel
            render={<button type="button" />}
            onClick={toggleHistory}
            onKeyDown={handleHistoryKeyDown}
            aria-expanded={historyOpen}
            className="group cursor-pointer select-none hover:text-foreground"
          >
            <span>History</span>
            <ChevronDown
              className={`ml-1 size-4 opacity-0 transition-transform group-hover:opacity-100 ${historyOpen ? "" : "-rotate-90"}`}
            />
          </SidebarGroupLabel>
          {historyOpen && (
            <SidebarGroupContent>
              <SidebarMenu>
                {renderJobs()}
                <div ref={sentinelRef} className="h-1" />
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={onOpenApiKeys}
            >
              <Key className="mr-2 size-4" />
              API Keys
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        {session?.user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="hover:bg-accent flex w-full cursor-pointer items-center gap-3 rounded-md px-4 py-3">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name ?? "User"}
                  width={32}
                  height={32}
                  loading="lazy"
                  decoding="async"
                  className="size-8 rounded-full"
                />
              ) : (
                <div className="bg-muted flex size-8 items-center justify-center rounded-full text-sm font-medium">
                  {session.user.name?.[0] ?? session.user.email?.[0] ?? "?"}
                </div>
              )}
              <div className="flex min-w-0 flex-col text-left">
                {session.user.name && (
                  <span className="truncate text-sm font-medium">
                    {session.user.name}
                  </span>
                )}
                <span className="text-muted-foreground truncate text-xs">
                  {session.user.email}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};
