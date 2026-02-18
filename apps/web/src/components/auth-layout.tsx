import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Desktop: split panel */}
      <div className="container relative hidden h-screen flex-1 shrink-0 items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        {/* Left — branding */}
        <div className="relative hidden h-full flex-col bg-primary p-10 text-primary-foreground lg:flex dark:border-r">
          {/* dot-grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle, currentColor 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <Link
            className="relative z-20 flex items-center font-semibold text-lg tracking-tight"
            to="/"
          >
            ocrbase
          </Link>

          <div className="relative z-20 mt-auto max-w-lg">
            <blockquote className="text-balance text-[15px] leading-relaxed opacity-80">
              &ldquo;ocrbase is built for developers who want to turn documents
              into structured, validated JSON in minutes. We focus on accuracy,
              speed, and simplicity&mdash;so you can skip manual data entry and
              ship reliable integrations fast.&rdquo;
            </blockquote>
            <footer className="mt-4 text-sm opacity-60">
              &mdash; Adam Majcher, Creator
            </footer>
          </div>
        </div>

        {/* Right — form */}
        <div className="flex items-center justify-center lg:h-full lg:p-8">
          {children}
        </div>
      </div>

      {/* Mobile: single column */}
      <div className="flex min-h-screen items-center justify-center p-6 md:hidden">
        <div className="w-full max-w-sm">
          <Link className="mb-8 flex items-center justify-center" to="/">
            <span className="font-semibold text-xl tracking-tight">
              ocrbase
            </span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
