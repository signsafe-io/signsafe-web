"use client";

import { useEffect, useRef, useState } from "react";
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
  // Use a ref so the async poll callback always reads the latest timerId value.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store callbacks in refs so the polling closure always invokes the latest
  // version without requiring a dep-driven effect restart.
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const j = await api.getIngestionJob(jobId);
        if (stopped) return; // component unmounted while request was in flight
        setJob(j);
        if (j.status === "completed" || j.status === "failed") {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          if (j.status === "completed") {
            onCompleteRef.current?.(j);
          } else {
            onErrorRef.current?.(j);
          }
        }
      } catch {
        // silently retry
      }
    }

    poll(); // immediate first poll
    timerRef.current = setInterval(poll, 1500);

    return () => {
      stopped = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [jobId]);

  if (!job) {
    // File upload is already done at this point — we are waiting for the first
    // ingestion job poll to return. "Uploading…" is therefore misleading.
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        <span>Processing…</span>
      </div>
    );
  }

  const progress = job.progress ?? 0;
  const label = STEP_LABELS[job.status] ?? job.status;

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
