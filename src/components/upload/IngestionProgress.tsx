"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { IngestionJob } from "@/types";

interface IngestionProgressProps {
  jobId: string;
  onComplete?: (job: IngestionJob) => void;
  onError?: (job: IngestionJob) => void;
}

const STEP_LABELS: Record<string, string> = {
  pending: "Queued",
  parsing: "Parsing document…",
  chunking: "Splitting into clauses…",
  indexing: "Building search index…",
  completed: "Complete",
  failed: "Failed",
};

export default function IngestionProgress({
  jobId,
  onComplete,
  onError,
}: IngestionProgressProps) {
  const [job, setJob] = useState<IngestionJob | null>(null);

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const j = await api.getIngestionJob(jobId);
        setJob(j);
        if (j.status === "completed") {
          if (timerId) clearInterval(timerId);
          onComplete?.(j);
        } else if (j.status === "failed") {
          if (timerId) clearInterval(timerId);
          onError?.(j);
        }
      } catch {
        // silently retry
      }
    }

    poll(); // immediate first poll
    timerId = setInterval(poll, 1500);

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        <span>Uploading…</span>
      </div>
    );
  }

  const progress = job.progress ?? 0;
  const label =
    STEP_LABELS[job.status] ?? job.status;

  const isFailed = job.status === "failed";
  const isComplete = job.status === "completed";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
        <div
          className={[
            "h-full rounded-full transition-all duration-300",
            isFailed ? "bg-red-500" : isComplete ? "bg-green-500" : "bg-zinc-700",
          ].join(" ")}
          style={{ width: `${progress}%` }}
        />
      </div>
      {isFailed && job.errorMessage && (
        <p className="text-xs text-red-600">{job.errorMessage}</p>
      )}
    </div>
  );
}
