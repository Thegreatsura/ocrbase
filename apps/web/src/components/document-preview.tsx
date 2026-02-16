import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { Panel } from "@/components/panel";
import { Spinner } from "@/components/ui/spinner";

const fetchBlob = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

const revokeBlobUrl = (url: string | undefined) => {
  if (url) {
    URL.revokeObjectURL(url);
  }
};

interface DocumentPreviewProps {
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}

export const DocumentPreview = ({
  fileUrl,
  fileName,
  mimeType,
}: DocumentPreviewProps) => {
  const isPdf = mimeType?.includes("pdf");
  const isImage = mimeType?.startsWith("image/");

  const { data: blobUrl, isLoading } = useQuery({
    enabled: !!fileUrl && (!!isPdf || !!isImage),
    gcTime: 5 * 60 * 1000,
    queryFn: () => fetchBlob(fileUrl ?? ""),
    queryKey: ["file-preview", fileUrl],
    staleTime: Infinity,
    structuralSharing: (old, next) => {
      revokeBlobUrl(old as string | undefined);
      return next;
    },
  });

  if (!fileUrl) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border bg-muted/50">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <FileText className="size-12" />
          <p>No preview available</p>
        </div>
      </div>
    );
  }

  return (
    <Panel title={fileName || "Document"} contentClassName="relative">
      {isPdf && (
        <>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner className="size-8 text-muted-foreground" />
            </div>
          )}
          {blobUrl ? (
            <object
              data={blobUrl}
              type="application/pdf"
              className="h-full w-full"
            >
              <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
                <FileText className="size-12 text-muted-foreground" />
                <p className="text-center text-muted-foreground">
                  PDF preview is not supported in your browser.
                </p>
              </div>
            </object>
          ) : null}
        </>
      )}

      {isImage && (
        <>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner className="size-8 text-muted-foreground" />
            </div>
          )}
          {blobUrl && (
            <img
              src={blobUrl}
              alt={fileName || "Document preview"}
              width={1200}
              height={1600}
              loading="lazy"
              decoding="async"
              className="mx-auto max-h-full max-w-full object-contain p-4"
            />
          )}
        </>
      )}

      {!isPdf && !isImage && (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">Unsupported file type</p>
        </div>
      )}
    </Panel>
  );
};
