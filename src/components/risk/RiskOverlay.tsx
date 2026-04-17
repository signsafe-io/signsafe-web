"use client";

import { useEffect, useRef, useState } from "react";
import type { ClauseResult, RiskLevel } from "@/types";

interface RiskOverlayProps {
  clauseResults: ClauseResult[];
  pageNumber: number;
  /** Page dimensions from react-pdf (in CSS pixels) */
  pageWidth: number;
  pageHeight: number;
  selectedClauseId?: string;
  onClauseClick?: (result: ClauseResult) => void;
}

const RISK_BAR_COLOR: Record<RiskLevel, string> = {
  HIGH: "rgba(239,68,68,0.85)",
  MEDIUM: "rgba(249,115,22,0.85)",
  LOW: "rgba(34,197,94,0.85)",
  none: "rgba(161,161,170,0.6)",
};

const RISK_FILL: Record<RiskLevel, string> = {
  HIGH: "rgba(239,68,68,0.18)",
  MEDIUM: "rgba(249,115,22,0.16)",
  LOW: "rgba(34,197,94,0.15)",
  none: "rgba(161,161,170,0.12)",
};

const RISK_BORDER: Record<RiskLevel, string> = {
  HIGH: "rgba(239,68,68,0.7)",
  MEDIUM: "rgba(249,115,22,0.7)",
  LOW: "rgba(34,197,94,0.7)",
  none: "rgba(161,161,170,0.5)",
};

const BAR_WIDTH = 3;

export default function RiskOverlay({
  clauseResults,
  pageNumber,
  pageWidth,
  pageHeight,
  selectedClauseId,
  onClauseClick,
}: RiskOverlayProps) {
  const [pulsingId, setPulsingId] = useState<string | null>(null);
  const prevSelectedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!selectedClauseId || selectedClauseId === prevSelectedRef.current) return;
    prevSelectedRef.current = selectedClauseId;
    setPulsingId(selectedClauseId);
    const t = setTimeout(() => setPulsingId(null), 1000);
    return () => clearTimeout(t);
  }, [selectedClauseId]);

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
        const x = (r.highlightX ?? 0) * pageWidth;
        const y = (r.highlightY ?? 0) * pageHeight;
        const w = (r.highlightWidth ?? 0) * pageWidth;
        const h = (r.highlightHeight ?? 0) * pageHeight;

        const effectiveLevel: RiskLevel =
          (r.overriddenRiskLevel as RiskLevel | null) ?? r.riskLevel;

        const isSelected = r.clauseId === selectedClauseId;
        const isPulsing = r.clauseId === pulsingId;

        return (
          <div
            key={r.id}
            className={[
              "pointer-events-auto absolute cursor-pointer group",
              isPulsing ? "animate-pulse" : "",
            ].join(" ")}
            style={{
              left: x,
              top: y,
              width: w,
              height: h,
              // Smooth transition for all visual properties
              transition: "background-color 200ms ease, border 200ms ease, box-shadow 200ms ease",
              // Selected: full wrap. Default: transparent (bar rendered separately)
              backgroundColor: isSelected ? RISK_FILL[effectiveLevel] : "transparent",
              border: isSelected
                ? `1.5px solid ${RISK_BORDER[effectiveLevel]}`
                : "none",
              borderLeft: `${BAR_WIDTH}px solid ${RISK_BAR_COLOR[effectiveLevel]}`,
              borderRadius: isSelected ? 3 : 0,
              boxShadow: isSelected
                ? `0 0 0 1.5px ${RISK_BORDER[effectiveLevel].replace(/[\d.]+\)$/, "0.25)")}`
                : undefined,
            }}
            onClick={() => onClauseClick?.(r)}
            title={r.issueType ? `${r.issueType} — 클릭하여 근거 보기` : "클릭하여 근거 보기"}
          >
            {/* Hover tooltip (non-selected only) */}
            {!isSelected && (
              <div className="absolute -top-5 left-0 hidden group-hover:flex items-center gap-1 rounded bg-zinc-800/90 px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap shadow-sm pointer-events-none">
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                근거 보기
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
