import type { JobStatus } from "@ocrbase/db/lib/enums";

import { Copy, Check, Download } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
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
  const [copied, setCopied] = useState(false);

  const jsonString = useMemo(
    () =>
      json === null || json === undefined
        ? null
        : JSON.stringify(json, null, 2),
    [json]
  );

  const handleCopy = useCallback(async () => {
    if (!jsonString) {
      return;
    }
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [jsonString]);

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
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border bg-muted/50">
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
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border bg-muted/50 px-6 text-center">
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

  const actions = (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy JSON to clipboard"}
      >
        {copied ? (
          <Check className="size-4 text-green-500" />
        ) : (
          <Copy className="size-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={handleDownload}
        aria-label="Download as JSON"
      >
        <Download className="size-4" />
      </Button>
    </>
  );

  return (
    <Panel title="Extracted Data" actions={actions}>
      <pre className="text-sm">
        <code className="text-foreground">{jsonString}</code>
      </pre>
    </Panel>
  );
};
