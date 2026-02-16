import * as React from "react";

import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-8 text-center",
        className
      )}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex flex-col items-center gap-2", className)}
      {...props}
    />
  );
}

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "icon";
}) {
  return (
    <div
      data-slot="empty-media"
      data-variant={variant}
      className={cn(
        "flex items-center justify-center",
        variant === "icon" && "rounded-full bg-muted p-3",
        className
      )}
      {...props}
    />
  );
}

function EmptyTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="empty-title"
      className={cn("font-medium", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("flex flex-col items-center gap-2", className)}
      {...props}
    />
  );
}

export {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
};
