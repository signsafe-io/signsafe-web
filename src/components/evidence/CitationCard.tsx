"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Modal, LoadingSpinner } from "@/components/ui/primitives";
import type { Citation } from "@/types";

interface CitationCardProps {
  citation: Citation;
  contractId: string;
}

// Type label without emoji
const TYPE_LABEL: Record<string, string> = {
  case: "판례",
  policy: "정책",
  guideline: "가이드라인",
  clause: "유사 조항",
  prec: "판례",
  law: "법령",
};

// Type icon — SVG only
function TypeIcon({ type }: { type: string }) {
  // Scale of justice icon — used for case law (case) and precedent (prec)
  if (type === "case" || type === "prec") {
    return (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    );
  }
  if (type === "policy") {
    return (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    );
  }
  // Book-open icon — used for statutory law (law)
  if (type === "law") {
    return (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    );
  }
  // default document icon
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

interface SnippetModal {
  open: boolean;
  content: string | null;
  loading: boolean;
  error: string | null;
}

export default function CitationCard({ citation, contractId }: CitationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState<SnippetModal>({
    open: false,
    content: null,
    loading: false,
    error: null,
  });

  async function handleViewSource() {
    if (citation.type !== "clause") return;
    const sourceContractId = citation.source ?? contractId;
    if (!sourceContractId) return;

    setModal({ open: true, content: null, loading: true, error: null });

    try {
      const resp = await api.listClauses(sourceContractId);
      const targetClause = resp.clauses.find((c) => c.id === citation.id);
      const text = targetClause
        ? targetClause.content
        : resp.clauses.map((c) => c.content).join("\n\n");
      setModal({ open: true, content: text || "(내용 없음)", loading: false, error: null });
    } catch {
      setModal({
        open: true,
        content: null,
        loading: false,
        error: "소스 스니펫을 불러오지 못했습니다.",
      });
    }
  }

  return (
    <>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3.5 space-y-2">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <TypeIcon type={citation.type} />
            <span className="text-xs font-medium">
              {TYPE_LABEL[citation.type] ?? citation.type}
            </span>
          </div>
          {citation.score != null && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              {Math.round(citation.score * 100)}% match
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-xs font-semibold text-zinc-800 leading-snug">
          {citation.title}
        </p>

        {/* Snippet */}
        <p
          className={`text-xs text-zinc-500 leading-relaxed ${
            expanded ? "" : "line-clamp-2"
          }`}
        >
          {citation.snippet}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-0.5">
          {citation.snippet && citation.snippet.length > 120 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="cursor-pointer text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-600"
            >
              {expanded ? "접기" : "더 보기"}
            </button>
          )}

          {citation.type === "clause" && (citation.source ?? contractId) && (
            <button
              onClick={handleViewSource}
              className="cursor-pointer text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-600 hover:underline"
            >
              소스 보기
            </button>
          )}
        </div>

        {/* Why relevant */}
        {citation.whyRelevant && (
          <div className="rounded-md bg-white px-3 py-2 ring-1 ring-zinc-200">
            <p className="text-xs text-zinc-500 leading-relaxed">
              <span className="font-medium text-zinc-600">Why relevant: </span>
              {citation.whyRelevant}
            </p>
          </div>
        )}
      </div>

      {/* Source snippet modal */}
      {modal.open && (
        <Modal onClose={() => setModal((s) => ({ ...s, open: false }))}>
          <div className="w-full max-w-lg animate-slide-in max-h-[70vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900">Source snippet</h3>
              <button
                onClick={() => setModal((s) => ({ ...s, open: false }))}
                className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {modal.loading && (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            )}
            {modal.error && (
              <p className="text-sm text-red-600">{modal.error}</p>
            )}
            {modal.content && (
              <pre className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed font-sans">
                {modal.content}
              </pre>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
