"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import type { ClauseResult, EvidenceSet, RiskLevel } from "@/types";
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
      {children}
    </p>
  );
}

// ─── Confidence gauge ───────────────────────────────────────────────────────

interface ConfidenceGaugeProps {
  /** 0.0 ~ 1.0 */
  value: number;
}

function confidenceLabel(v: number): string {
  if (v >= 0.7) return "높음";
  if (v >= 0.4) return "보통";
  return "낮음";
}

function confidenceColors(v: number): {
  bar: string;
  text: string;
  bg: string;
  ring: string;
} {
  if (v >= 0.7)
    return {
      bar: "bg-green-500",
      text: "text-green-700",
      bg: "bg-green-50",
      ring: "ring-green-200",
    };
  if (v >= 0.4)
    return {
      bar: "bg-amber-400",
      text: "text-amber-700",
      bg: "bg-amber-50",
      ring: "ring-amber-200",
    };
  return {
    bar: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
    ring: "ring-red-200",
  };
}

function ConfidenceGauge({ value }: ConfidenceGaugeProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const label = confidenceLabel(value);
  const { bar, text, bg, ring } = confidenceColors(value);

  return (
    <div className="mt-2.5 flex items-center gap-2.5">
      {/* Bar */}
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`AI 신뢰도 ${pct}%`}
      >
        <div
          className={`h-full rounded-full transition-all ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Badge */}
      <span
        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ring-1 whitespace-nowrap ${bg} ${text} ${ring}`}
      >
        {label}&nbsp;{pct}%
      </span>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

const MIN_WIDTH = 280;
const MAX_WIDTH = 680;
const DEFAULT_WIDTH = 384; // sm:w-96
const MIN_CENTER_WIDTH = 280;

export default function EvidencePanel({
  clauseResult,
  analysisId,
  contractId,
  onClose,
  onOverrideApplied,
}: EvidencePanelProps) {
  const [evidenceSet, setEvidenceSet] = useState<EvidenceSet | null>(null);
  const [loadState, setLoadState] = useState<EvidenceLoadState>("idle");
  const [showOverride, setShowOverride] = useState(false);

  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const panelRef = useRef<HTMLElement>(null);
  const dragState = useRef<{
    startX: number;
    startWidth: number;
    maxWidth: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // 드래그 시작 시점에 컨테이너 크기를 한 번만 측정해 maxWidth 확정
      let maxWidth = MAX_WIDTH;
      const panel = panelRef.current;
      if (panel?.parentElement) {
        const container = panel.parentElement;
        const containerWidth = container.offsetWidth;
        // 패널보다 앞에 있는 flex-shrink-0 형제(좌측 조항 내비게이션) 너비 합산
        let leftFixedWidth = 0;
        for (const child of Array.from(container.children)) {
          if (child === panel) break;
          if (window.getComputedStyle(child as HTMLElement).flexShrink === "0") {
            leftFixedWidth += (child as HTMLElement).offsetWidth;
          }
        }
        maxWidth = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, containerWidth - leftFixedWidth - MIN_CENTER_WIDTH),
        );
      }
      dragState.current = { startX: e.clientX, startWidth: panelWidth, maxWidth };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [panelWidth],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    // 이미 rAF가 예약돼 있으면 스킵 — 화면 주사율로 자동 스로틀링
    if (rafRef.current !== null) return;
    const clientX = e.clientX;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!dragState.current) return;
      const delta = dragState.current.startX - clientX;
      const next = Math.min(
        dragState.current.maxWidth,
        Math.max(MIN_WIDTH, dragState.current.startWidth + delta),
      );
      setPanelWidth(next);
    });
  }, []);

  const onPointerUp = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    dragState.current = null;
  }, []);

  const effectiveLevel: RiskLevel =
    (clauseResult.overriddenRiskLevel as RiskLevel | null) ??
    clauseResult.riskLevel;

  const evidenceSetId = clauseResult.evidenceSetId;

  // confidence is 0~1; default 0.5 if missing
  const confidence: number =
    typeof clauseResult.confidence === "number" ? clauseResult.confidence : 0.5;

  useEffect(() => {
    setEvidenceSet(null);
    if (!evidenceSetId) {
      setLoadState("idle");
      return;
    }
    setLoadState("loading");
    api
      .getEvidenceSet(evidenceSetId)
      .then((es) => {
        setEvidenceSet(es);
        setLoadState("success");
      })
      .catch(() => setLoadState("error"));
  }, [evidenceSetId]);

  const citations = evidenceSet?.citations ?? [];
  const actions = evidenceSet?.recommendedActions ?? [];

  return (
    <AnimatePresence>
      <motion.aside
        ref={panelRef}
        key="evidence-panel"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="relative flex flex-shrink-0 flex-col overflow-hidden border-l border-zinc-200 bg-white"
        style={{ width: panelWidth, height: "100%" }}
      >
        {/* Resize handle */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="group absolute inset-y-0 left-0 z-10 w-3 cursor-col-resize select-none"
          title="드래그하여 너비 조절"
        >
          <div className="absolute inset-y-0 left-1 w-0.5 bg-transparent transition-colors group-hover:bg-blue-400 group-active:bg-blue-500" />
        </div>

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
                title="리스크 수준 수정"
              >
                수정
              </button>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="패널 닫기"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Confidence gauge — always shown when analysis result present */}
          <div>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              AI 신뢰도
            </p>
            <ConfidenceGauge value={confidence} />
          </div>

          {clauseResult.overriddenRiskLevel && clauseResult.overrideReason && (
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed line-clamp-2">
              <span className="font-medium text-zinc-500">오버라이드 사유: </span>
              {clauseResult.overrideReason}
            </p>
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Summary */}
          {clauseResult.summary && (
            <div className="border-b border-zinc-100 px-4 py-4">
              <SectionLabel>요약</SectionLabel>
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
                <p className="text-sm text-zinc-400">증거 데이터가 없습니다.</p>
              </div>
            ) : loadState === "loading" ? (
              <div className="flex justify-center py-10">
                <LoadingSpinner size="sm" />
              </div>
            ) : loadState === "error" ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                증거를 불러오지 못했습니다.
              </div>
            ) : evidenceSet ? (
              <>
                {/* Rationale */}
                <div>
                  <SectionLabel>판단 근거</SectionLabel>
                  <p className="text-sm text-zinc-700 leading-relaxed">
                    {evidenceSet.rationale}
                  </p>
                </div>

                {/* Citations */}
                {citations.length > 0 && (
                  <div>
                    <SectionLabel>
                      지원 증거 ({citations.length})
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
                  </div>
                )}

                {/* Recommended actions */}
                {actions.length > 0 && (
                  <div>
                    <SectionLabel>권장 조치</SectionLabel>
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
