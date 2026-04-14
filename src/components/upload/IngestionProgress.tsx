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
  pending:   "대기 중",
  parsing:   "문서 파싱 중…",
  chunking:  "조항 분리 중…",
  indexing:  "검색 인덱스 구축 중…",
  completed: "완료",
  failed:    "실패",
};

export default function IngestionProgress({
  jobId,
  onComplete,
  onError,
}: IngestionProgressProps) {
  const [job, setJob] = useState<IngestionJob | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let stopped = false;
    let failCount = 0;
    const MAX_FAILS = 5;

    async function poll() {
      try {
        const j = await api.getIngestionJob(jobId);
        if (stopped) return;
        failCount = 0;
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
        if (stopped) return;
        failCount += 1;
        if (failCount >= MAX_FAILS) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setJob((prev) =>
            prev
              ? { ...prev, status: "failed", errorMessage: "서버와 연결할 수 없습니다. 페이지를 새로고침해 주세요." }
              : prev
          );
          setNetworkError(true);
        }
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
    if (networkError) {
      return (
        <p className="text-xs text-red-600">서버와 연결할 수 없습니다. 페이지를 새로고침해 주세요.</p>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500" />
        <span>처리 중…</span>
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
