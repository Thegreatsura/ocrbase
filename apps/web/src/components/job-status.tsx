import type { JobStatus } from "@ocrbase/db/lib/enums";

import { CheckCircle, XCircle, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

interface JobStatusProps {
  status: JobStatus;
  progress?: number;
}

export const JobStatusBadge = ({ status, progress }: JobStatusProps) => {
  const statusConfig: Record<
    JobStatus,
    {
      label: string;
      icon: React.ReactNode;
      variant: "default" | "secondary" | "destructive" | "outline";
    }
  > = {
    completed: {
      icon: <CheckCircle className="size-3" />,
      label: "Completed",
      variant: "outline",
    },
    extracting: {
      icon: <Spinner className="size-3" />,
      label: "Extracting",
      variant: "default",
    },
    failed: {
      icon: <XCircle className="size-3" />,
      label: "Failed",
      variant: "destructive",
    },
    pending: {
      icon: <Clock className="size-3" />,
      label: "Pending",
      variant: "secondary",
    },
    processing: {
      icon: <Spinner className="size-3" />,
      label: progress ? `Processing ${progress}%` : "Processing",
      variant: "default",
    },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
};
