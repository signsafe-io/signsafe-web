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
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900">Override risk level</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-500">
          Current assessment: <RiskBadge level={currentLevel} className="ml-1" />
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              New risk level
            </label>
            <div className="flex gap-2">
              {RISK_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setNewLevel(level)}
                  className={[
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    newLevel === level
                      ? "border-zinc-800 bg-zinc-900 text-white"
                      : "border-zinc-300 text-zinc-600 hover:border-zinc-500",
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
              className="mb-1 block text-sm font-medium text-zinc-700"
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
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save override"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
