import type { HTMLAttributes, ReactNode } from "react";

import { Check, Copy, FileCode2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/* ─── DocsPre ─────────────────────────────────────────────────────────────── */
/* Drop-in `pre` override for fumadocs MDX so docs code blocks match the     */
/* landing-page CodeBlock styling. Accepts Shiki-highlighted React children. */

interface DocsPreProps extends HTMLAttributes<HTMLPreElement> {
  title?: string;
  icon?: ReactNode;
}

export function DocsPre({
  children,
  title,
  icon: _icon,
  style,
  className,
  ...props
}: DocsPreProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const pre = areaRef.current?.querySelector("pre");
    if (pre) {
      navigator.clipboard.writeText(pre.textContent ?? "");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="my-4 flex flex-col not-prose">
      <div
        role="region"
        aria-label={typeof title === "string" ? title : "Code block"}
        className="relative overflow-hidden rounded-md border border-border"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileCode2 className="size-4 shrink-0" />
              <span className="truncate font-medium">{title}</span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={copied ? "Copied" : "Copy code to clipboard"}
            >
              {copied ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
        )}

        <div ref={areaRef} className="overflow-x-auto bg-secondary/40">
          <pre
            className={cn(
              "py-5 font-mono text-[13px] leading-[1.7] [&_code]:flex [&_code]:flex-col [&_.line]:px-5",
              className
            )}
            style={{ ...style, backgroundColor: "transparent" }}
            {...props}
          >
            {children}
          </pre>
        </div>

        {!title && (
          <div className="absolute right-2 top-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={copied ? "Copied" : "Copy code to clipboard"}
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── CodeBlock ────────────────────────────────────────────────────────────── */

interface CodeBlockProps {
  /** The code to display (plain text). */
  children: string;
  /** Optional pre-highlighted HTML. When provided, rendered via dangerouslySetInnerHTML instead of plain text. */
  html?: string;
  /** Filename shown in the header bar. */
  filename?: string;
  /** Language hint (currently informational). */
  language?: string;
  /** Accessible label for the code block. */
  "aria-label"?: string;
  /** Additional class names on the outer wrapper. */
  className?: string;
  /** Caption rendered below the code block. */
  caption?: string;
  /** Show line numbers. Defaults to true. */
  lineNumbers?: boolean;
  /** Extra action buttons rendered in the header next to the copy button. */
  actions?: ReactNode;
}

export function CodeBlock({
  children,
  html,
  filename,
  "aria-label": ariaLabel,
  className,
  caption,
  lineNumbers = true,
  actions,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  const lines = children.split("\n");
  const htmlLines = html?.split("\n");
  const lineCount = lines.length;
  const gutterWidth = String(lineCount).length;
  const renderedLines = useMemo(() => {
    const seenCounts = new Map<string, number>();

    return (htmlLines ?? lines).map((line) => {
      const nextCount = (seenCounts.get(line) ?? 0) + 1;
      seenCounts.set(line, nextCount);

      return {
        key: `${line}::${nextCount}`,
        line,
      };
    });
  }, [htmlLines, lines]);

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        role="region"
        aria-label={ariaLabel ?? filename ?? "Code block"}
        className="relative flex flex-1 flex-col overflow-hidden rounded-md border border-border"
      >
        {/* ── header ── */}
        {filename && (
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileCode2 className="size-4 shrink-0" />
              <span className="truncate font-medium">{filename}</span>
            </div>
            <div className="flex items-center gap-1">
              {actions}
              <button
                type="button"
                onClick={handleCopy}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={copied ? "Copied" : "Copy code to clipboard"}
              >
                {copied ? (
                  <Check className="size-3.5 text-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── code area ── */}
        <div className="min-h-0 flex-1 overflow-auto bg-secondary/40">
          <pre className="py-5 font-mono text-[13px] leading-[1.7]">
            <code>
              {renderedLines.map(({ key, line }, i) => (
                <div key={key} className="flex px-5">
                  {lineNumbers && (
                    <span
                      className="mr-6 inline-block shrink-0 select-none text-right text-muted-foreground/50"
                      style={{ minWidth: `${gutterWidth}ch` }}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                  )}
                  {htmlLines ? (
                    <span
                      className="flex-1"
                      style={{ color: "var(--syntax-plain)" }}
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: line }}
                    />
                  ) : (
                    <span className="flex-1 text-foreground">{line}</span>
                  )}
                </div>
              ))}
            </code>
          </pre>
        </div>

        {/* ── copy button when no header ── */}
        {!filename && (
          <div className="absolute right-2 top-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={copied ? "Copied" : "Copy code to clipboard"}
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {caption && (
        <p className="mt-3 text-[13px] text-muted-foreground">{caption}</p>
      )}
    </div>
  );
}
