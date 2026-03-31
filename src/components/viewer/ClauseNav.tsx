"use client";

import type { Clause, ClauseResult, RiskLevel } from "@/types";
import RiskBadge from "@/components/risk/RiskBadge";

interface ClauseNavProps {
  clauses: Clause[];
  clauseResults: ClauseResult[];
  selectedClauseId?: string;
  onClauseSelect: (clause: Clause) => void;
}

function buildResultMap(results: ClauseResult[]): Map<string, ClauseResult> {
  return new Map(results.map((r) => [r.clauseId, r]));
}

const RISK_INDICATOR: Record<RiskLevel, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-green-500",
  none: "bg-zinc-300",
};

export default function ClauseNav({
  clauses,
  clauseResults,
  selectedClauseId,
  onClauseSelect,
}: ClauseNavProps) {
  const resultMap = buildResultMap(clauseResults);
  const analyzedCount = clauseResults.length;

  return (
    <nav className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-100 px-4 py-3.5">
        <p className="text-xs font-semibold text-zinc-900">
          Clauses
          <span className="ml-1.5 font-normal text-zinc-400">
            ({clauses.length})
          </span>
        </p>
        {analyzedCount > 0 && (
          <p className="mt-0.5 text-xs text-zinc-400">
            {analyzedCount} analyzed
          </p>
        )}
      </div>

      {/* Empty state */}
      {clauses.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
            <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            No clauses extracted yet.
          </p>
        </div>
      )}

      {/* List */}
      {clauses.length > 0 && (
        <ul className="flex-1 overflow-y-auto space-y-0.5 px-2 py-2">
          {clauses.map((clause) => {
            const result = resultMap.get(clause.id);
            const riskLevel: RiskLevel =
              (result?.overriddenRiskLevel as RiskLevel | null) ??
              result?.riskLevel ??
              "none";
            const isSelected = clause.id === selectedClauseId;
            const hasResult = !!result;

            return (
              <li key={clause.id}>
                <button
                  onClick={() => onClauseSelect(clause)}
                  className={[
                    "cursor-pointer group w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-100",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Risk indicator dot */}
                    <span
                      className={[
                        "mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full",
                        isSelected && hasResult ? "opacity-80" : "",
                        hasResult ? RISK_INDICATOR[riskLevel] : "bg-transparent",
                      ].join(" ")}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex-1 leading-snug line-clamp-2 text-xs font-medium">
                          {clause.label ?? `Clause ${clause.clauseIndex + 1}`}
                        </span>
                        {result && (
                          <RiskBadge
                            level={riskLevel}
                            overridden={!!result.overriddenRiskLevel}
                            className={isSelected ? "opacity-90 flex-shrink-0" : "flex-shrink-0"}
                          />
                        )}
                      </div>
                      {clause.pageStart > 0 && (
                        <span
                          className={`mt-0.5 block text-xs ${
                            isSelected ? "text-zinc-400" : "text-zinc-400"
                          }`}
                        >
                          p.&nbsp;{clause.pageStart}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
