"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Citation } from "@/types";

interface CitationCardProps {
  citation: Citation;
  contractId: string;
}

const TYPE_ICON: Record<string, string> = {
  case: "⚖️",
  policy: "📋",
  guideline: "📌",
  clause: "📄",
};

const TYPE_LABEL: Record<string, string> = {
  case: "Case law",
  policy: "Policy",
  guideline: "Guideline",
  clause: "Similar clause",
};

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
    if (citation.type !== "clause" || !contractId) return;
    setModal({ open: true, content: null, loading: true, error: null });

    try {
      const resp = await api.getSnippets(contractId, 1, 0, 500);
      const snippets = resp.snippets;
      const text = snippets.map((s) => s.content).join("\n\n");
      setModal({ open: true, content: text, loading: false, error: null });
    } catch {
      setModal({
        open: true,
        content: null,
        loading: false,
        error: "Failed to load source snippet.",
      });
    }
  }

  return (
    <>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm" role="img" aria-label={citation.type}>
              {TYPE_ICON[citation.type] ?? "📄"}
            </span>
            <span className="text-xs font-medium text-zinc-500">
              {TYPE_LABEL[citation.type] ?? citation.type}
            </span>
          </div>
          {citation.score != null && (
            <span className="text-xs text-zinc-400">
              {Math.round(citation.score * 100)}% match
            </span>
          )}
        </div>

        <p className="text-sm font-medium text-zinc-800">{citation.title}</p>

        <p className={`text-xs text-zinc-500 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
          {citation.snippet}
        </p>

        <div className="flex items-center gap-3 pt-0.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            {expanded ? "Show less" : "Show more"}
          </button>

          {citation.type === "clause" && contractId && (
            <button
              onClick={handleViewSource}
              className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
            >
              View source
            </button>
          )}
        </div>

        {citation.whyRelevant && (
          <div className="rounded bg-white px-2 py-1.5 ring-1 ring-zinc-200">
            <p className="text-xs text-zinc-500 italic">
              Why relevant: {citation.whyRelevant}
            </p>
          </div>
        )}
      </div>

      {/* Snippet modal */}
      {modal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setModal((s) => ({ ...s, open: false }))}
        >
          <div
            className="w-full max-w-lg max-h-[70vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-zinc-900">
                Source snippet
              </h3>
              <button
                onClick={() => setModal((s) => ({ ...s, open: false }))}
                className="text-zinc-400 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>

            {modal.loading && (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
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
        </div>
      )}
    </>
  );
}
