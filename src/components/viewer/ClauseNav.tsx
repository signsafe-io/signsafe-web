"use client";

import { useState } from "react";
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

// All filterable risk levels (excludes "none" — unanalyzed clauses are always shown)
const FILTER_LEVELS: Array<{ level: RiskLevel; label: string; activeClass: string }> = [
  {
    level: "HIGH",
    label: "높음",
    activeClass: "bg-red-100 text-red-700 ring-red-300",
  },
  {
    level: "MEDIUM",
    label: "중간",
    activeClass: "bg-amber-100 text-amber-700 ring-amber-300",
  },
  {
    level: "LOW",
    label: "낮음",
    activeClass: "bg-green-100 text-green-700 ring-green-300",
  },
];

/** Threshold below which the confidence is considered low and a warning is shown. */
const LOW_CONFIDENCE_THRESHOLD = 0.4;

/**
 * Small warning icon shown next to clauses with low AI confidence (< 0.4).
 * Helps reviewers prioritise manual checks.
 */
function LowConfidenceIcon({ isSelected }: { isSelected: boolean }) {
  return (
    <svg
      className={`h-3 w-3 flex-shrink-0 ${isSelected ? "text-amber-300" : "text-amber-500"}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-label="낮은 신뢰도"
      role="img"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function ClauseNav({
  clauses,
  clauseResults,
  selectedClauseId,
  onClauseSelect,
}: ClauseNavProps) {
  const resultMap = buildResultMap(clauseResults);
  const analyzedCount = clauseResults.length;

  // Set of active filter levels. Empty set = show all.
  const [activeFilters, setActiveFilters] = useState<Set<RiskLevel>>(new Set());

  function toggleFilter(level: RiskLevel) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }

  function clearFilters() {
    setActiveFilters(new Set());
  }

  // Derive the effective risk level of a clause (respecting overrides).
  function getEffectiveRiskLevel(clause: Clause): RiskLevel {
    const result = resultMap.get(clause.id);
    if (!result) return "none";
    return (result.overriddenRiskLevel as RiskLevel | null) ?? result.riskLevel;
  }

  // Apply filter: if no active filters, show all. Otherwise show only matching.
  const visibleClauses =
    activeFilters.size === 0
      ? clauses
      : clauses.filter((clause) => {
          const level = getEffectiveRiskLevel(clause);
          // Always show unanalyzed clauses when filtering — they have no risk level.
          if (level === "none") return true;
          return activeFilters.has(level);
        });

  const hasAnalysis = analyzedCount > 0;

  return (
    <nav className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-zinc-100 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-zinc-900">
            조항
            <span className="ml-1.5 font-normal text-zinc-400">
              ({activeFilters.size > 0 ? `${visibleClauses.length}/` : ""}
              {clauses.length})
            </span>
          </p>
          {hasAnalysis && activeFilters.size > 0 && (
            <button
              onClick={clearFilters}
              className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              초기화
            </button>
          )}
        </div>
        {hasAnalysis && (
          <p className="mt-0.5 text-xs text-zinc-400">{analyzedCount}개 분석됨</p>
        )}

        {/* Risk filter toggles — shown only when analysis results are available */}
        {hasAnalysis && (
          <div className="mt-2.5 flex items-center gap-1.5">
            {FILTER_LEVELS.map(({ level, label, activeClass }) => {
              const isActive = activeFilters.has(level);
              // Count clauses at this risk level (considering overrides).
              const count = clauseResults.filter((r) => {
                const effective =
                  (r.overriddenRiskLevel as RiskLevel | null) ?? r.riskLevel;
                return effective === level;
              }).length;

              return (
                <button
                  key={level}
                  onClick={() => toggleFilter(level)}
                  title={`${label} 리스크 필터 (${count}개 조항)`}
                  className={[
                    "cursor-pointer inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 transition-colors",
                    isActive
                      ? activeClass
                      : "bg-zinc-50 text-zinc-500 ring-zinc-200 hover:bg-zinc-100",
                  ].join(" ")}
                >
                  {label}
                  {count > 0 && (
                    <span
                      className={[
                        "tabular-nums rounded-full px-1 text-xs",
                        isActive ? "opacity-80" : "text-zinc-400",
                      ].join(" ")}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
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
            아직 추출된 조항이 없습니다.
          </p>
        </div>
      )}

      {/* Filter empty state — all clauses filtered out */}
      {clauses.length > 0 && visibleClauses.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
            <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            선택한 필터에 맞는 조항이 없습니다.
          </p>
          <button
            onClick={clearFilters}
            className="cursor-pointer text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
          >
            필터 초기화
          </button>
        </div>
      )}

      {/* List */}
      {visibleClauses.length > 0 && (
        <ul className="flex-1 overflow-y-auto space-y-0.5 px-2 py-2">
          {visibleClauses.map((clause) => {
            const result = resultMap.get(clause.id);
            const riskLevel: RiskLevel =
              (result?.overriddenRiskLevel as RiskLevel | null) ??
              result?.riskLevel ??
              "none";
            const isSelected = clause.id === selectedClauseId;
            const hasResult = !!result;

            // Show low-confidence warning when confidence is available and below threshold.
            // Only applies to analyzed clauses; suppress when overridden (human judgement takes over).
            const confidence =
              typeof result?.confidence === "number" ? result.confidence : null;
            const isLowConfidence =
              hasResult &&
              !result?.overriddenRiskLevel &&
              confidence !== null &&
              confidence < LOW_CONFIDENCE_THRESHOLD;

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
                        <span className="flex-1 leading-snug line-clamp-1 text-xs font-medium">
                          {clause.label ?? `Clause ${clause.clauseIndex + 1}`}
                        </span>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          {/* Low confidence warning icon */}
                          {isLowConfidence && (
                            <span title={`AI 신뢰도 낮음 (${Math.round((confidence ?? 0) * 100)}%) — 수동 검토 권장`}>
                              <LowConfidenceIcon isSelected={isSelected} />
                            </span>
                          )}
                          {result && (
                            <RiskBadge
                              level={riskLevel}
                              overridden={!!result.overriddenRiskLevel}
                              className={isSelected ? "opacity-90" : ""}
                            />
                          )}
                        </div>
                      </div>
                      {clause.content && (
                        <p
                          className={`mt-0.5 line-clamp-2 text-xs leading-relaxed ${
                            isSelected ? "text-zinc-300" : "text-zinc-400"
                          }`}
                        >
                          {clause.content}
                        </p>
                      )}
                      {clause.pageStart > 0 && (
                        <span
                          className={`mt-0.5 block text-xs ${
                            isSelected ? "text-zinc-300" : "text-zinc-400"
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
