"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/primitives";
import type { ClauseResult, RiskLevel, RiskOverride } from "@/types";
import RiskBadge from "@/components/risk/RiskBadge";

interface OverrideDialogProps {
  clauseResult: ClauseResult;
  analysisId: string;
  onClose: () => void;
  onApplied: (updated: ClauseResult) => void;
}

const RISK_LEVELS: RiskLevel[] = ["HIGH", "MEDIUM", "LOW"];

const LEVEL_STYLES: Record<RiskLevel, string> = {
  HIGH: "border-red-200 text-red-700 data-[selected]:border-red-600 data-[selected]:bg-red-600 data-[selected]:text-white",
  MEDIUM: "border-amber-200 text-amber-700 data-[selected]:border-amber-500 data-[selected]:bg-amber-500 data-[selected]:text-white",
  LOW: "border-green-200 text-green-700 data-[selected]:border-green-600 data-[selected]:bg-green-600 data-[selected]:text-white",
  none: "border-zinc-200 text-zinc-600",
};

export default function OverrideDialog({
  clauseResult,
  analysisId,
  onClose,
  onApplied,
}: OverrideDialogProps) {
  const currentLevel: RiskLevel =
    (clauseResult.overriddenRiskLevel as RiskLevel | null) ?? clauseResult.riskLevel;

  const [newLevel, setNewLevel] = useState<RiskLevel>(currentLevel);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a reason for the override.");
      return;
    }
    if (newLevel === currentLevel) {
      setError("Please select a different risk level.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const override: RiskOverride = await api.createOverride(
        analysisId,
        clauseResult.id,
        newLevel,
        reason.trim()
      );

      const updated: ClauseResult = {
        ...clauseResult,
        overriddenRiskLevel: override.newRiskLevel,
        overrideReason: override.reason,
        overriddenBy: override.decidedBy,
        overriddenAt: override.createdAt,
      };

      onApplied(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save override.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="w-full max-w-md animate-slide-in rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900">Override risk level</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-5 flex items-center gap-2 text-sm text-zinc-500">
          Current assessment:
          <RiskBadge level={currentLevel} />
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2.5 block text-sm font-medium text-zinc-700">
              New risk level
            </label>
            <div className="flex gap-2">
              {RISK_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setNewLevel(level)}
                  data-selected={newLevel === level ? true : undefined}
                  className={[
                    "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                    newLevel === level
                      ? level === "HIGH"
                        ? "border-red-600 bg-red-600 text-white"
                        : level === "MEDIUM"
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-green-600 bg-green-600 text-white"
                      : LEVEL_STYLES[level],
                  ].join(" ")}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="override-reason"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              id="override-reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why the AI assessment should be overridden…"
              className="w-full resize-none rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
                  Saving…
                </span>
              ) : (
                "Save override"
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
