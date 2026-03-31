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

  // evidenceSetId is included in the GET /risk-analyses/:id response via
  // LEFT JOIN on evidence_sets (signsafe-api #16).
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
      // Re-fetch the evidence set after retrieve.
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
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex w-96 flex-shrink-0 flex-col border-l border-zinc-200 bg-white"
        style={{ height: "100%" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <RiskBadge
              level={effectiveLevel}
              overridden={!!clauseResult.overriddenRiskLevel}
            />
            {clauseResult.issueType && (
              <span className="text-xs text-zinc-500">{clauseResult.issueType}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowOverride(true)}
              className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
              title="Override risk level"
            >
              Override
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Summary */}
          {clauseResult.summary && (
            <div className="border-b border-zinc-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Summary
              </p>
              <p className="text-sm text-zinc-700 leading-relaxed">
                {clauseResult.summary}
              </p>
            </div>
          )}

          {/* Evidence */}
          <div className="flex-1 px-4 py-3 space-y-4">
            {!evidenceSetId ? (
              <p className="text-sm text-zinc-400">
                No evidence data available for this clause.
              </p>
            ) : loadState === "loading" ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            ) : loadState === "error" ? (
              <p className="text-sm text-red-500">Failed to load evidence.</p>
            ) : evidenceSet ? (
              <>
                {/* Rationale */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Rationale
                  </p>
                  <p className="text-sm text-zinc-700 leading-relaxed">
                    {evidenceSet.rationale}
                  </p>
                </div>

                {/* Citations */}
                {citations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      Supporting evidence ({citations.length})
                    </p>
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
                      className="mt-3 text-xs text-zinc-500 hover:text-zinc-900 hover:underline disabled:opacity-50"
                    >
                      {retrieving ? "Loading more…" : "Load more evidence"}
                    </button>
                  </div>
                )}

                {/* Recommended actions */}
                {actions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      Recommended actions
                    </p>
                    <ul className="space-y-1.5">
                      {actions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                          <span className="mt-0.5 flex-shrink-0 h-4 w-4 rounded border border-zinc-300" />
                          {action}
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
