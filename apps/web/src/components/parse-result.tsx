import type { JobStatus } from "@ocrbase/db/lib/enums";

import { Copy, Check, Download } from "lucide-react";
import { lazy, Suspense, useCallback, useState } from "react";

import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const MarkdownRenderer = lazy(async () => {
  const [
    { default: ReactMarkdown },
    { default: remarkGfm },
    { default: rehypeRaw },
  ] = await Promise.all([
    import("react-markdown"),
    import("remark-gfm"),
    import("rehype-raw"),
  ]);

  return {
    default: ({ markdown }: { markdown: string }) => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{ img: () => null }}
      >
        {markdown}
      </ReactMarkdown>
    ),
  };
});

interface ParseResultProps {
  markdown: string | null;
  isLoading?: boolean;
  jobId?: string;
  status?: JobStatus;
  errorMessage?: string | null;
}

export const ParseResult = ({
  markdown,
  isLoading,
  jobId,
  status,
  errorMessage,
}: ParseResultProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!markdown) {
      return;
    }
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [markdown]);

  const handleDownload = useCallback(() => {
    if (!markdown) {
      return;
    }
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${jobId || "result"}.md`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [markdown, jobId]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md border bg-muted/50">
        <Spinner className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Processing document…</p>
        {errorMessage && (
          <p className="max-w-xs text-center text-xs text-destructive">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border bg-muted/50 px-6 text-center">
        <p className="text-sm font-medium text-destructive">
          Processing failed
        </p>
        <p className="text-sm text-muted-foreground">
          {errorMessage ?? "This job failed before producing markdown."}
        </p>
      </div>
    );
  }

  const hasContent = markdown !== null && markdown.trim().length > 0;

  if (!hasContent) {
    return (
      <Panel title="Result">
        <div className="text-muted-foreground flex h-full min-h-28 items-center justify-center text-sm">
          No text was extracted from this document.
        </div>
      </Panel>
    );
  }

  const actions = (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
      >
        {copied ? (
          <Check className="size-4 text-success" />
        ) : (
          <Copy className="size-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={handleDownload}
        aria-label="Download as markdown"
      >
        <Download className="size-4" />
      </Button>
    </>
  );

  return (
    <Panel title="Result" actions={actions}>
      <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_tr:hover]:bg-muted/50">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-8">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          }
        >
          <MarkdownRenderer markdown={markdown} />
        </Suspense>
      </div>
    </Panel>
  );
};
