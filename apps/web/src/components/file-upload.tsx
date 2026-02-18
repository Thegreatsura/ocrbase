import type { InfiniteData } from "@tanstack/react-query";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FilePlus2 } from "lucide-react";
import { useCallback, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/tiff",
];

interface FileUploadProps {
  mode: "parse" | "extract";
  title: string;
  description: string;
}

export const FileUpload = ({ mode, title, description }: FileUploadProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const endpoint = mode === "extract" ? api.v1.extract : api.v1.parse;
      const res = await endpoint.post({ file });
      if (res.error) {
        throw new Error(
          typeof res.error === "object" && "message" in res.error
            ? String(res.error.message)
            : "Upload failed"
        );
      }
      return res.data as { id: string };
    },
    onSuccess: (data, file) => {
      interface JobsPageResponse {
        data: {
          id: string;
          type: string;
          status: string;
          fileName: string | null;
          createdAt: string;
        }[];
        pagination: {
          currentPage: number;
          hasNextPage: boolean;
          totalCount: number;
        };
      }

      const newJob = {
        createdAt: new Date().toISOString(),
        fileName: file.name,
        id: data.id,
        status: "pending" as const,
        type: mode,
      };

      const upsertJobsList = (
        old: InfiniteData<JobsPageResponse> | undefined
      ): InfiniteData<JobsPageResponse> => {
        if (!old) {
          return {
            pageParams: [1],
            pages: [
              {
                data: [newJob],
                pagination: {
                  currentPage: 1,
                  hasNextPage: false,
                  totalCount: 1,
                },
              },
            ],
          };
        }
        return {
          ...old,
          pages: old.pages.map((page, i) =>
            i === 0
              ? {
                  ...page,
                  data: [newJob, ...page.data],
                  pagination: {
                    ...page.pagination,
                    totalCount: page.pagination.totalCount + 1,
                  },
                }
              : page
          ),
        };
      };

      queryClient.setQueriesData<InfiniteData<JobsPageResponse>>(
        { queryKey: ["jobs"] },
        upsertJobsList
      );

      const activeOrganizationId = session?.session.activeOrganizationId;
      if (activeOrganizationId) {
        queryClient.setQueryData<InfiniteData<JobsPageResponse>>(
          ["jobs", activeOrganizationId],
          upsertJobsList
        );
      }

      const route = mode === "extract" ? "/extract/$jobId" : "/parse/$jobId";
      navigate({ params: { jobId: data.id }, to: route });
    },
  });

  const handleUpload = useCallback(
    (file: File) => {
      setValidationError(null);
      uploadMutation.mutate(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploadMutation.mutate]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setValidationError(null);
      uploadMutation.reset();

      const [droppedFile] = e.dataTransfer.files;
      if (droppedFile && ACCEPTED_TYPES.includes(droppedFile.type)) {
        handleUpload(droppedFile);
      } else {
        setValidationError(
          "Please upload a PDF or image file (PNG, JPEG, WebP, TIFF)"
        );
      }
    },
    [handleUpload, uploadMutation]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValidationError(null);
      uploadMutation.reset();
      const selectedFile = e.target.files?.[0];
      if (selectedFile && ACCEPTED_TYPES.includes(selectedFile.type)) {
        handleUpload(selectedFile);
      } else if (selectedFile) {
        setValidationError(
          "Please upload a PDF or image file (PNG, JPEG, WebP, TIFF)"
        );
      }
    },
    [handleUpload, uploadMutation]
  );

  const error = validationError ?? uploadMutation.error?.message ?? null;

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex w-full flex-col items-center justify-center gap-6 rounded-2xl border border-dashed p-12 transition-colors
          ${isDragging ? "border-accent bg-accent/5" : "border-border/50 bg-muted/30 hover:border-border hover:bg-muted/50"}
          ${uploadMutation.isPending || uploadMutation.isSuccess ? "pointer-events-none" : ""}
        `}
      >
        {uploadMutation.isPending || uploadMutation.isSuccess ? (
          <div className="flex flex-col items-center gap-4">
            <Spinner className="size-10 text-muted-foreground" />
            <p className="font-medium">Processing…</p>
          </div>
        ) : (
          <>
            <div className="flex size-14 items-center justify-center rounded-md bg-secondary">
              <FilePlus2 className="size-7 text-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Click to upload, or drag and drop</p>
              <p className="text-sm text-muted-foreground">
                PDF or image files up to 50&nbsp;MB each
              </p>
            </div>
            <label
              htmlFor="file-upload"
              className="absolute inset-0 cursor-pointer"
            >
              <span className="sr-only">Upload a document</span>
              <input
                id="file-upload"
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};
