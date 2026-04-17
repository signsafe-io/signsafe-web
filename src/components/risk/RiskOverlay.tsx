"use client";

import type { ClauseResult, RiskLevel } from "@/types";

interface RiskOverlayProps {
  clauseResults: ClauseResult[];
  pageNumber: number;
  /** Page dimensions from react-pdf (in CSS pixels) */
  pageWidth: number;
  pageHeight: number;
  onClauseClick?: (result: ClauseResult) => void;
}

const RISK_COLORS: Record<RiskLevel, string> = {
  HIGH: "rgba(239,68,68,0.25)",
  MEDIUM: "rgba(249,115,22,0.22)",
  LOW: "rgba(34,197,94,0.20)",
  none: "rgba(161,161,170,0.15)",
};

const RISK_BORDER: Record<RiskLevel, string> = {
  HIGH: "rgba(239,68,68,0.7)",
  MEDIUM: "rgba(249,115,22,0.7)",
  LOW: "rgba(34,197,94,0.7)",
  none: "rgba(161,161,170,0.5)",
};

export default function RiskOverlay({
  clauseResults,
  pageNumber,
  pageWidth,
  pageHeight,
  onClauseClick,
}: RiskOverlayProps) {
  // Filter results that have coordinates and belong to this page.
  const visible = clauseResults.filter(
    (r) =>
      r.pageNumber === pageNumber &&
      r.highlightX != null &&
      r.highlightY != null &&
      r.highlightWidth != null &&
      r.highlightHeight != null
  );

  if (visible.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      style={{ width: pageWidth, height: pageHeight }}
    >
      {visible.map((r) => {
        // Coordinates from the API are relative (0-1 fractions of the page).
        // Multiply by actual rendered page dimensions.
        const x = (r.highlightX ?? 0) * pageWidth;
        const y = (r.highlightY ?? 0) * pageHeight;
        const w = (r.highlightWidth ?? 0) * pageWidth;
        const h = (r.highlightHeight ?? 0) * pageHeight;

        const effectiveLevel: RiskLevel =
          (r.overriddenRiskLevel as RiskLevel | null) ?? r.riskLevel;

        return (
          <div
            key={r.id}
            className="pointer-events-auto absolute cursor-pointer transition-opacity hover:opacity-80 group"
            style={{
              left: x,
              top: y,
              width: w,
              height: h,
              backgroundColor: RISK_COLORS[effectiveLevel],
              border: `1.5px solid ${RISK_BORDER[effectiveLevel]}`,
              borderRadius: 3,
            }}
            onClick={() => onClauseClick?.(r)}
            title={r.issueType ? `${r.issueType} — 클릭하여 근거 보기` : "클릭하여 근거 보기"}
          >
            {/* Click hint icon */}
            <div className="absolute -top-5 left-0 hidden group-hover:flex items-center gap-1 rounded bg-zinc-800/90 px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap shadow-sm pointer-events-none">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              근거 보기
            </div>
          </div>
        );
      })}
    </div>
  );
}
