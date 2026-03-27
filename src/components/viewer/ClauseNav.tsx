"use client";

import type { Clause, ClauseResult, RiskLevel } from "@/types";
import RiskBadge from "@/components/risk/RiskBadge";

interface ClauseNavProps {
  clauses: Clause[];
  clauseResults: ClauseResult[];
  selectedClauseId?: string;
  onClauseSelect: (clause: Clause) => void;
}

/** Build a lookup from clauseId → ClauseResult */
function buildResultMap(results: ClauseResult[]): Map<string, ClauseResult> {
  return new Map(results.map((r) => [r.clauseId, r]));
}

export default function ClauseNav({
  clauses,
  clauseResults,
  selectedClauseId,
  onClauseSelect,
}: ClauseNavProps) {
  const resultMap = buildResultMap(clauseResults);

  return (
    <nav className="flex flex-col overflow-y-auto">
      <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Clauses ({clauses.length})
      </p>
      <ul className="space-y-0.5 px-2 pb-4">
        {clauses.map((clause) => {
          const result = resultMap.get(clause.id);
          const riskLevel: RiskLevel =
            (result?.overriddenRiskLevel as RiskLevel | null) ??
            result?.riskLevel ??
            "none";
          const isSelected = clause.id === selectedClauseId;

          return (
            <li key={clause.id}>
              <button
                onClick={() => onClauseSelect(clause)}
                className={[
                  "w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                  isSelected
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-700 hover:bg-zinc-100",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex-1 leading-snug line-clamp-2">
                    {clause.label ?? `Clause ${clause.clauseIndex + 1}`}
                  </span>
                  {result && (
                    <RiskBadge
                      level={riskLevel}
                      overridden={!!result.overriddenRiskLevel}
                      className={isSelected ? "opacity-90" : ""}
                    />
                  )}
                </div>
                {clause.pageStart > 0 && (
                  <span
                    className={`mt-0.5 text-xs ${
                      isSelected ? "text-zinc-300" : "text-zinc-400"
                    }`}
                  >
                    Page {clause.pageStart}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
