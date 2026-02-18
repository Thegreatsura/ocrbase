import { Link } from "@tanstack/react-router";
import { Github } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-300 items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="text-[17px] font-semibold tracking-tight text-foreground"
          >
            ocrbase
          </Link>
          <div className="hidden items-center gap-6 text-[14px] text-muted-foreground md:flex">
            <Link
              to="/docs/$"
              params={{ _splat: "" }}
              className="transition-colors hover:text-foreground"
            >
              Docs
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/ocrbase-hq/ocrbase"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground sm:flex"
          >
            <Github className="h-4 w-4" />
            <span className="text-[13px] font-medium">~1K</span>
          </a>
          <a
            href="https://cal.com/amajcher/ocrbase"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ size: "default", variant: "outline" }),
              "rounded-md px-4 text-[14px]"
            )}
          >
            Talk to Founder
          </a>
          <Link
            to="/app"
            className={cn(
              buttonVariants({ size: "default", variant: "default" }),
              "rounded-md px-4 text-[14px]"
            )}
          >
            Try Playground
          </Link>
        </div>
      </div>
    </nav>
  );
}
