"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { ClauseResult, EvidenceSet, Citation, RiskLevel } from "@/types";
import RiskBadge from "@/components/risk/RiskBadge";
import CitationCard from "@/components/evidence/CitationCard";
import OverrideDialog from "@/components/risk/OverrideDialog";
import { LoadingSpinner } from "@/components/ui/primitives";

interface EvidencePanelProps {
  clauseResult: ClauseResult;
  analysisId: string;
  contractId: string;
  onClose: () => void;
  onOverrideApplied: (updated: ClauseResult) => void;
}

type EvidenceLoadState = "idle" | "loading" | "success" | "error";

function parseCitations(raw: string): Citation[] {
  try {
    return JSON.parse(raw) as Citation[];
  } catch {
    return [];
  }
}

function parseActions(raw: string): string[] {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
      {children}
    </p>
  );
}

export default function EvidencePanel({
  clauseResult,
  analysisId,
  contractId,
  onClose,
  onOverrideApplied,
}: EvidencePanelProps) {
  const [evidenceSet, setEvidenceSet] = useState<EvidenceSet | null>(null);
  const [loadState, setLoadState] = useState<EvidenceLoadState>("idle");
  const [retrieving, setRetrieving] = useState(false);
  const [showOverride, setShowOverride] = useState(false);

  const effectiveLevel: RiskLevel =
    (clauseResult.overriddenRiskLevel as RiskLevel | null) ??
    clauseResult.riskLevel;

  const evidenceSetId = clauseResult.evidenceSetId;

  useEffect(() => {
    if (!evidenceSetId) return;
    setLoadState("loading");
    api
      .getEvidenceSet(evidenceSetId)
      .then((es) => {
        setEvidenceSet(es);
        setLoadState("success");
      })
      .catch(() => setLoadState("error"));
  }, [evidenceSetId]);

  async function handleRetrieveMore() {
    if (!evidenceSetId) return;
    setRetrieving(true);
    try {
      await api.retrieveEvidence(evidenceSetId, 10);
      const updated = await api.getEvidenceSet(evidenceSetId);
      setEvidenceSet(updated);
    } catch {
      // silently ignore
    } finally {
      setRetrieving(false);
    }
  }

  const citations = evidenceSet ? parseCitations(evidenceSet.citations) : [];
  const actions = evidenceSet ? parseActions(evidenceSet.recommendedActions) : [];

  return (
    <AnimatePresence>
      <motion.aside
        key="evidence-panel"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="flex w-full max-w-sm flex-shrink-0 flex-col border-l border-zinc-200 bg-white sm:w-96"
        style={{ height: "100%" }}
      >
        {/* Header */}
        <div className="border-b border-zinc-100 px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <RiskBadge
                level={effectiveLevel}
                overridden={!!clauseResult.overriddenRiskLevel}
              />
              {clauseResult.issueType && (
                <span className="truncate text-xs text-zinc-500">
                  {clauseResult.issueType}
                </span>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                onClick={() => setShowOverride(true)}
                className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                title="Override risk level"
              >
                Override
              </button>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Close panel"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          {clauseResult.overriddenRiskLevel && clauseResult.overrideReason && (
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed line-clamp-2">
              <span className="font-medium text-zinc-500">Override reason: </span>
              {clauseResult.overrideReason}
            </p>
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Summary */}
          {clauseResult.summary && (
            <div className="border-b border-zinc-100 px-4 py-4">
              <SectionLabel>Summary</SectionLabel>
              <p className="text-sm text-zinc-700 leading-relaxed">
                {clauseResult.summary}
              </p>
            </div>
          )}

          {/* Evidence body */}
          <div className="flex-1 px-4 py-4 space-y-5">
            {!evidenceSetId ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                  <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-400">No evidence data available.</p>
              </div>
            ) : loadState === "loading" ? (
              <div className="flex justify-center py-10">
                <LoadingSpinner size="sm" />
              </div>
            ) : loadState === "error" ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                Failed to load evidence.
              </div>
            ) : evidenceSet ? (
              <>
                {/* Rationale */}
                <div>
                  <SectionLabel>Rationale</SectionLabel>
                  <p className="text-sm text-zinc-700 leading-relaxed">
                    {evidenceSet.rationale}
                  </p>
                </div>

                {/* Citations */}
                {citations.length > 0 && (
                  <div>
                    <SectionLabel>
                      Supporting evidence ({citations.length})
                    </SectionLabel>
                    <div className="space-y-2">
                      {citations.map((citation) => (
                        <CitationCard
                          key={citation.id}
                          citation={citation}
                          contractId={contractId}
                        />
                      ))}
                    </div>
                    <button
                      onClick={handleRetrieveMore}
                      disabled={retrieving}
                      className="mt-3 flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-50"
                    >
                      {retrieving ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-500" />
                          Loading more…
                        </>
                      ) : (
                        "Load more evidence"
                      )}
                    </button>
                  </div>
                )}

                {/* Recommended actions */}
                {actions.length > 0 && (
                  <div>
                    <SectionLabel>Recommended actions</SectionLabel>
                    <ul className="space-y-2">
                      {actions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-700">
                          <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-[10px] font-semibold text-zinc-400">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Override dialog */}
        {showOverride && (
          <OverrideDialog
            clauseResult={clauseResult}
            analysisId={analysisId}
            onClose={() => setShowOverride(false)}
            onApplied={(updated) => {
              onOverrideApplied(updated);
              setShowOverride(false);
            }}
          />
        )}
      </motion.aside>
    </AnimatePresence>
  );
}
