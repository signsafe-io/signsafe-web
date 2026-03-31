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

      {/* List */}
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
                  "group w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  isSelected
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-700 hover:bg-zinc-100",
                ].join(" ")}
              >
                <div className="flex items-start gap-2.5">
                  {/* Risk indicator dot */}
                  {hasResult && (
                    <span
                      className={[
                        "mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full",
                        isSelected ? "opacity-90" : "",
                        RISK_INDICATOR[riskLevel],
                      ].join(" ")}
                    />
                  )}
                  {!hasResult && (
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-transparent" />
                  )}

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
                        p. {clause.pageStart}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
