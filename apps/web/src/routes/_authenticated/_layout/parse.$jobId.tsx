import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

import { DocumentPreview } from "@/components/document-preview";
import { ParseResult } from "@/components/parse-result";
import { useJob } from "@/hooks/use-job";
import { isJobProcessing, jobQueryOptions } from "@/lib/queries";

const ParseJobPage = () => {
  const { jobId } = Route.useParams();
  const { data: job } = useJob(jobId);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 md:grid-cols-2">
        <DocumentPreview
          fileUrl={job?.fileUrl}
          fileName={job?.fileName}
          mimeType={job?.mimeType}
        />
        <ParseResult
          markdown={job?.markdownResult ?? null}
          isLoading={isJobProcessing(job?.status)}
          jobId={jobId}
          status={job?.status}
          errorMessage={job?.errorMessage}
        />
      </div>
    </div>
  );
};

const JobErrorComponent = () => {
  const router = useRouter();
  const handleRetry = useCallback(() => router.invalidate(), [router]);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <p className="text-muted-foreground">Failed to load job.</p>
      <button
        type="button"
        className="text-sm text-primary rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={handleRetry}
      >
        Retry
      </button>
    </div>
  );
};

export const Route = createFileRoute("/_authenticated/_layout/parse/$jobId")({
  component: ParseJobPage,
  errorComponent: JobErrorComponent,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(jobQueryOptions(params.jobId)),
});
