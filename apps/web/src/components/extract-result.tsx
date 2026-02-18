import type { JobStatus } from "@ocrbase/db/lib/enums";

import { Download } from "lucide-react";
import { useCallback, useMemo } from "react";

import { Panel } from "@/components/panel";
import { CodeBlock } from "@/components/ui/code-block";
import { Spinner } from "@/components/ui/spinner";

interface ExtractResultProps {
  json: unknown;
  isLoading?: boolean;
  jobId?: string;
  status?: JobStatus;
  errorMessage?: string | null;
}

export const ExtractResult = ({
  json,
  isLoading,
  jobId,
  status,
  errorMessage,
}: ExtractResultProps) => {
  const jsonString = useMemo(
    () =>
      json === null || json === undefined
        ? null
        : JSON.stringify(json, null, 2),
    [json]
  );

  const handleDownload = useCallback(() => {
    if (!jsonString) {
      return;
    }
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${jobId || "result"}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [jsonString, jobId]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md border bg-muted/50">
        <Spinner className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Extracting data…</p>
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
          Extraction failed
        </p>
        <p className="text-sm text-muted-foreground">
          {errorMessage ?? "This job failed before producing JSON output."}
        </p>
      </div>
    );
  }

  if (json === null || json === undefined) {
    return (
      <Panel title="Extracted Data">
        <div className="text-muted-foreground flex h-full min-h-28 items-center justify-center text-sm">
          No structured data was extracted from this document.
        </div>
      </Panel>
    );
  }

  if (!jsonString) {
    return (
      <Panel title="Extracted Data">
        <div className="text-muted-foreground flex h-full min-h-28 items-center justify-center text-sm">
          No structured data was extracted from this document.
        </div>
      </Panel>
    );
  }

  const downloadButton = (
    <button
      type="button"
      onClick={handleDownload}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Download as JSON"
    >
      <Download className="size-3.5" />
    </button>
  );

  return (
    <CodeBlock
      filename={`${jobId || "result"}.json`}
      language="json"
      lineNumbers={false}
      actions={downloadButton}
      className="h-full min-h-0 overflow-hidden [&>div]:h-full [&>div>div:last-child]:min-h-0 [&>div>div:last-child]:flex-1"
    >
      {jsonString}
    </CodeBlock>
  );
};
