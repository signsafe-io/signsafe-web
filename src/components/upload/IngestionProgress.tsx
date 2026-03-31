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
  pending:   "Queued",
  parsing:   "Parsing document…",
  chunking:  "Splitting into clauses…",
  indexing:  "Building search index…",
  completed: "Complete",
  failed:    "Failed",
};

export default function IngestionProgress({
  jobId,
  onComplete,
  onError,
}: IngestionProgressProps) {
  const [job, setJob] = useState<IngestionJob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
        if (stopped) return;
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

    poll();
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
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500" />
        <span>Processing…</span>
      </div>
    );
  }

  const progress = job.progress ?? 0;
  const label = STEP_LABELS[job.status] ?? job.status;
  const isFailed = job.status === "failed";
  const isComplete = job.status === "completed";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          {!isFailed && !isComplete && (
            <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500" />
          )}
          {isComplete && (
            <svg className="h-3 w-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isFailed && (
            <svg className="h-3 w-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {label}
        </span>
        <span className="font-medium tabular-nums">{progress}%</span>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={[
            "h-full rounded-full transition-all duration-300",
            isFailed ? "bg-red-500" : isComplete ? "bg-green-500" : "bg-zinc-600",
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
