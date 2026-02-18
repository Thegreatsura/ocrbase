import { Check, ChevronDown, Copy, Link } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type CopyMode = "content" | "url";

export function CopyPageButton() {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const copy = useCallback(async (mode: CopyMode) => {
    if (mode === "url") {
      await navigator.clipboard.writeText(window.location.href);
    } else {
      const article = document.querySelector("article");
      if (!article) {
        return;
      }
      await navigator.clipboard.writeText(article.textContent ?? "");
    }
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleCopyContent = useCallback(async () => {
    await copy("content");
  }, [copy]);

  const handleCopyUrl = useCallback(async () => {
    await copy("url");
  }, [copy]);

  const handleToggleOpen = useCallback(() => {
    setOpen((value) => !value);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleCopyContent}
        className="flex items-center gap-1.5 rounded-l-md border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {copied ? (
          <Check className="size-3.5 text-success" />
        ) : (
          <Copy className="size-3.5" />
        )}
        <span>{copied ? "Copied!" : "Copy page"}</span>
      </button>
      <button
        type="button"
        onClick={handleToggleOpen}
        className="flex items-center rounded-r-md border border-l-0 border-border bg-secondary/50 px-1.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Copy options"
      >
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-max overflow-hidden rounded-md border border-border bg-popover shadow-md">
          <button
            type="button"
            onClick={handleCopyContent}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm whitespace-nowrap text-popover-foreground transition-colors hover:bg-accent"
          >
            <Copy className="size-3.5 shrink-0" />
            Copy page content
          </button>
          <button
            type="button"
            onClick={handleCopyUrl}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm whitespace-nowrap text-popover-foreground transition-colors hover:bg-accent"
          >
            <Link className="size-3.5 shrink-0" />
            Copy page URL
          </button>
        </div>
      )}
    </div>
  );
}
