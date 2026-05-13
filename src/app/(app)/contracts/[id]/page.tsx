"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type {
  Contract,
  Clause,
  ClauseResult,
  RiskAnalysis,
  RiskAnalysisResponse,
} from "@/types";
import ClauseNav from "@/components/viewer/ClauseNav";
import EditContractModal from "@/components/contract/EditContractModal";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/primitives";

// ─── Expiry helpers ─────────────────────────────────────────────────────────

function getContractExpiryBadge(expiresAt: string | null): { label: string; cls: string } | null {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "만료됨", cls: "bg-red-50 text-red-600 ring-red-200" };
  if (days === 0) return { label: "오늘 만료", cls: "bg-red-50 text-red-600 ring-red-200" };
  if (days <= 30) return { label: `D-${days}`, cls: "bg-amber-50 text-amber-700 ring-amber-200" };
  return null;
}


const DocumentViewer = dynamic(
  () => import("@/components/viewer/DocumentViewer"),
  { ssr: false }
);

const EvidencePanel = dynamic(
  () => import("@/components/evidence/EvidencePanel"),
  { ssr: false }
);

interface PageParams {
  id: string;
}

type AnalysisState =
  | { phase: "idle" }
  | { phase: "requesting" }
  | { phase: "polling"; analysisId: string }
  | { phase: "done"; analysisId: string };

// Contract statuses that indicate document is still being processed.
const PROCESSING_STATUSES = new Set(["uploaded", "processing"]);

const PROCESSING_STEP_LABEL: Record<string, string> = {
  uploaded: "처리 대기 중…",
  processing: "문서 처리 중…",
};

export default function ContractViewerPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { id: contractId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const scrollTargetRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [contract, setContract] = useState<Contract | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [clauseResults, setClauseResults] = useState<ClauseResult[]>([]);
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ phase: "idle" });
  const [selectedClauseResult, setSelectedClauseResult] = useState<ClauseResult | null>(null);
  const [selectedClauseId, setSelectedClauseId] = useState<string | undefined>(undefined);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showClauseDrawer, setShowClauseDrawer] = useState(false);

  const applyAnalysisResponse = useCallback(
    (resp: RiskAnalysisResponse, notify?: boolean) => {
      setAnalysis(resp.analysis);
      setClauseResults(resp.clauseResults ?? []);
      if (resp.analysis.status === "completed" || resp.analysis.status === "failed") {
        setAnalysisState({ phase: "done", analysisId: resp.analysis.id });
        if (notify) {
          if (resp.analysis.status === "completed") {
            toast("success", `분석 완료 — ${(resp.clauseResults ?? []).length}개 조항 검토됨.`);
          } else {
            toast("error", "분석에 실패했습니다. 다시 시도해주세요.");
          }
        }
      }
    },
    [toast]
  );

  // Load PDF blob and update pdfBlobUrl.
  const loadPdfBlob = useCallback(async (cid: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
    const res = await fetch(`${API_URL}/contracts/${cid}/file`, {
      headers: {
        Authorization: `Bearer ${
          (await import("@/lib/auth")).useAuthStore.getState().accessToken ?? ""
        }`,
      },
      credentials: "include",
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoadState("loading");
      try {
        const [contractData, clausesData] = await Promise.all([
          api.getContract(contractId),
          api.listClauses(contractId),
        ]);

        setContract(contractData);
        setClauses(clausesData.clauses ?? []);
        setLoadState("success");

        try {
          const analysisResp = await api.getLatestAnalysis(contractId);
          if (analysisResp) {
            applyAnalysisResponse(analysisResp);
            if (
              analysisResp.analysis.status === "pending" ||
              analysisResp.analysis.status === "running"
            ) {
              setAnalysisState({ phase: "polling", analysisId: analysisResp.analysis.id });
            }
          }
        } catch {
          // No existing analysis — stay idle.
        }

        // Only attempt PDF load when document is ready.
        if (!PROCESSING_STATUSES.has(contractData.status)) {
          await loadPdfBlob(contractId);
        }
      } catch {
        setLoadState("error");
      }
    }
    load();

    return () => {
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [contractId, applyAnalysisResponse, loadPdfBlob]);

  // Poll contract status when document is still being processed.
  useEffect(() => {
    if (!contract) return;
    if (!PROCESSING_STATUSES.has(contract.status)) return;

    let timerId: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let failCount = 0;
    const MAX_FAILS = 5;

    async function pollContract() {
      try {
        const updated = await api.getContract(contractId);
        if (stopped) return;
        failCount = 0;
        setContract(updated);

        if (!PROCESSING_STATUSES.has(updated.status)) {
          // Document finished processing — reload clauses and PDF.
          if (timerId) clearInterval(timerId);
          try {
            const clausesData = await api.listClauses(contractId);
            if (!stopped) setClauses(clausesData.clauses ?? []);
          } catch {
            // non-critical
          }
          if (updated.status === "ready") {
            await loadPdfBlob(contractId);
            toast("success", "문서 처리가 완료되어 분석할 준비가 됐습니다.");
          } else if (updated.status === "failed") {
            toast("error", "문서 처리에 실패했습니다.");
          }
        }
      } catch {
        if (stopped) return;
        failCount += 1;
        if (failCount >= MAX_FAILS) {
          if (timerId) clearInterval(timerId);
          toast("error", "서버 연결이 끊겼습니다. 페이지를 새로고침해 주세요.");
        }
      }
    }

    timerId = setInterval(pollContract, 2500);

    return () => {
      stopped = true;
      if (timerId) clearInterval(timerId);
    };
  }, [contract?.status, contractId, loadPdfBlob, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll analysis when in polling phase.
  useEffect(() => {
    if (analysisState.phase !== "polling") return;
    const { analysisId } = analysisState;
    let timerId: ReturnType<typeof setInterval> | null = null;
    let failCount = 0;
    const MAX_FAILS = 5;

    async function poll() {
      try {
        const resp = await api.getAnalysis(analysisId);
        failCount = 0;
        applyAnalysisResponse(resp, true);
        if (resp.analysis.status === "completed" || resp.analysis.status === "failed") {
          if (timerId) clearInterval(timerId);
        }
      } catch {
        failCount += 1;
        if (failCount >= MAX_FAILS) {
          if (timerId) clearInterval(timerId);
          setAnalysisState({ phase: "idle" });
          toast("error", "분석 상태를 확인할 수 없습니다. 페이지를 새로고침해 주세요.");
        }
      }
    }

    poll();
    timerId = setInterval(poll, 2000);

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [analysisState, applyAnalysisResponse]);

  // Lock body scroll when drawer is open on mobile.
  useEffect(() => {
    if (showClauseDrawer) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showClauseDrawer]);

  async function handleRequestAnalysis() {
    setAnalysisState({ phase: "requesting" });
    try {
      const resp = await api.createAnalysis(contractId);
      setAnalysisState({ phase: "polling", analysisId: resp.analysisId });
    } catch (err: unknown) {
      toast("error", `분석 시작 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      setAnalysisState({ phase: "idle" });
    }
  }

  function handleClauseSelect(clause: Clause) {
    setSelectedClauseId(clause.id);
    const pageKey = `page-${clause.pageStart}`;
    const el = scrollTargetRef.current.get(pageKey);
    if (el && scrollContainerRef.current) {
      const top = el.offsetTop - (scrollContainerRef.current.offsetTop ?? 0) - 16;
      scrollContainerRef.current.scrollTo({ top, behavior: "smooth" });
    }
    // Open evidence panel if analysis result exists for this clause.
    const result = clauseResults.find((r) => r.clauseId === clause.id);
    if (result) {
      setSelectedClauseResult(result);
    }
    // Close drawer on mobile after selection.
    setShowClauseDrawer(false);
  }

  function handleClauseClick(result: ClauseResult) {
    setSelectedClauseResult(result);
    setSelectedClauseId(result.clauseId);
  }

  const isDocumentProcessing = contract ? PROCESSING_STATUSES.has(contract.status) : false;
  const isDocumentFailed = contract?.status === "failed";

  const isAnalysisRunning =
    analysisState.phase === "requesting" ||
    analysisState.phase === "polling" ||
    analysis?.status === "running";

  function analysisButtonLabel() {
    if (analysisState.phase === "requesting") return "시작 중…";
    if (analysisState.phase === "polling") return "분석 중…";
    return "AI 분석 실행";
  }

  const showReanalyzeButton =
    !isAnalysisRunning &&
    !isDocumentProcessing &&
    (analysis?.status === "completed" || analysis?.status === "failed") &&
    loadState === "success";

  // Show a prominent CTA banner when document is ready but no analysis has been run yet.
  const showAnalysisCta =
    loadState === "success" &&
    !isDocumentProcessing &&
    !isDocumentFailed &&
    contract?.status === "ready" &&
    analysisState.phase === "idle" &&
    analysis === null &&
    clauses.length > 0;

  // Analysis button is disabled if document is still processing or no clauses extracted.
  const isAnalysisDisabled =
    isAnalysisRunning ||
    isDocumentProcessing ||
    isDocumentFailed ||
    loadState !== "success" ||
    clauses.length === 0;

  if (loadState === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-900">계약서를 불러오지 못했습니다</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
        >
          뒤로 가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen overflow-hidden overflow-x-hidden">
      {/* Left: Clause navigation — desktop only */}
      <aside className="hidden w-64 flex-shrink-0 overflow-y-auto border-r border-zinc-200 bg-white md:block lg:w-72">
        {loadState === "loading" ? (
          <div className="space-y-0.5 px-2 py-2">
            {/* Clause nav skeleton */}
            <div className="border-b border-zinc-100 px-2 py-3.5 mb-2">
              <div className="h-3.5 w-20 animate-pulse rounded bg-zinc-200" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5">
                <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-zinc-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-full animate-pulse rounded bg-zinc-200" />
                  <div className="h-2.5 w-2/3 animate-pulse rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ClauseNav
            clauses={clauses}
            clauseResults={clauseResults}
            selectedClauseId={selectedClauseId}
            onClauseSelect={handleClauseSelect}
          />
        )}
      </aside>

      {/* Center: Document viewer */}
      <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto bg-zinc-100 min-w-0">
        {/* Toolbar */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-2.5 shadow-sm sm:px-4">
          {/* Left: breadcrumb */}
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <button
              onClick={() => router.push("/contracts")}
              className="cursor-pointer flex flex-shrink-0 items-center gap-1 text-zinc-400 transition-colors hover:text-zinc-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden text-xs sm:inline">계약서</span>
            </button>
            {contract && (
              <>
                <span className="hidden text-zinc-200 sm:inline">/</span>
                <span className="hidden truncate font-medium text-zinc-800 max-w-[140px] sm:block md:max-w-xs">
                  {contract.title}
                </span>
              </>
            )}
          </div>

          {/* Right: status + actions */}
          <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Expiry badge — shown when contract is expiring within 30 days or already expired */}
            {contract?.expiresAt && (() => {
              const badge = getContractExpiryBadge(contract.expiresAt);
              return badge ? (
                <span
                  className={`hidden sm:inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.cls}`}
                >
                  {badge.label}
                </span>
              ) : null;
            })()}
            {/* Document processing badge */}
            {isDocumentProcessing && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                <span className="h-1.5 w-1.5 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
                <span className="hidden sm:inline">처리 중</span>
              </span>
            )}
            {isDocumentFailed && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-red-200 hidden sm:inline-flex">
                처리 실패
              </span>
            )}

            {analysis?.status === "completed" && !isDocumentProcessing && (
              <span className="text-xs text-zinc-400 hidden sm:inline tabular-nums">
                {clauseResults.length}개 조항
              </span>
            )}
            {analysis?.status === "failed" && !isDocumentProcessing && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-red-200 hidden sm:inline-flex">
                분석 실패
              </span>
            )}
            {(analysisState.phase === "polling" || analysis?.status === "running") && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-400" />
                분석 중
              </span>
            )}

            {/* Mobile: Clauses button — opens bottom sheet */}
            {loadState === "success" && clauses.length > 0 && (
              <button
                onClick={() => setShowClauseDrawer(true)}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 md:hidden"
                title="조항 목록 보기"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>조항</span>
                {clauseResults.length > 0 && (
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs tabular-nums">
                    {clauseResults.length}
                  </span>
                )}
              </button>
            )}

            {loadState === "success" && (
              <button
                onClick={() => setShowEditModal(true)}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                title="계약서 정보 수정"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <span className="hidden sm:inline">계약서 수정</span>
              </button>
            )}

            {showReanalyzeButton ? (
              <button
                onClick={handleRequestAnalysis}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                title="AI 분석 재실행"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden sm:inline">재분석</span>
              </button>
            ) : (
              <button
                onClick={handleRequestAnalysis}
                disabled={isAnalysisDisabled}
                title={
                  isDocumentProcessing
                    ? "문서를 아직 처리 중입니다"
                    : isDocumentFailed
                    ? "문서 처리에 실패했습니다"
                    : clauses.length === 0
                    ? "아직 추출된 조항이 없습니다"
                    : undefined
                }
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAnalysisRunning ? (
                  <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                ) : (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                )}
                {analysisButtonLabel()}
              </button>
            )}
          </div>
        </div>

        {/* Document processing state — shown while contract is being ingested */}
        {isDocumentProcessing && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
              <svg className="h-7 w-7 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-zinc-800">
              {contract ? PROCESSING_STEP_LABEL[contract.status] ?? "Processing…" : "Processing…"}
            </p>
            <p className="mt-1.5 text-xs text-zinc-400">
              문서에서 조항을 추출하고 있습니다. 보통 1분 이내에 완료됩니다.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-zinc-400">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500" />
              <span>업데이트 확인 중…</span>
            </div>
          </div>
        )}

        {/* Document failed state — shown as banner, not replacing the viewer */}
        {isDocumentFailed && !isDocumentProcessing && (
          <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              {clauses.length > 0 ? (
                <>
                  <p className="text-sm font-semibold text-red-800">AI 분석 준비에 실패했습니다</p>
                  <p className="mt-0.5 text-xs text-red-600">
                    조항 {clauses.length}개가 추출됐지만 AI 분석을 위한 인덱싱에 실패했습니다. 관리자에게 문의하거나 파일을 다시 업로드해 주세요.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-800">조항 추출에 실패했습니다</p>
                  <p className="mt-0.5 text-xs text-red-600">
                    이 파일에서 조항을 추출하지 못했습니다. PDF는 계속 볼 수 있지만 AI 분석은 지원되지 않습니다.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Analysis CTA banner — shown when document is ready but not yet analyzed */}
        {showAnalysisCta && (
          <div className="mx-4 mt-4 flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-indigo-900">이 계약서는 아직 분석되지 않았습니다</p>
                <p className="mt-0.5 text-xs text-indigo-700">
                  AI 분석을 실행하여 리스크를 파악하고 이상 조항을 찾아 권장 사항을 받아보세요.
                </p>
              </div>
            </div>
            <button
              onClick={handleRequestAnalysis}
              className="cursor-pointer flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800 sm:self-center"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI 분석 실행
            </button>
          </div>
        )}

        {/* Document summary card — shown after analysis completes with a summary */}
        {analysis?.status === "completed" && analysis.documentSummary && (() => {
          // Parse keyIssues: the API may return a JSON-encoded string or a real array.
          let issues: string[] = [];
          if (Array.isArray(analysis.keyIssues)) {
            issues = analysis.keyIssues;
          } else if (typeof analysis.keyIssues === "string") {
            try {
              const parsed: unknown = JSON.parse(analysis.keyIssues);
              if (Array.isArray(parsed)) {
                issues = parsed.filter((x): x is string => typeof x === "string");
              }
            } catch {
              // Unparseable — leave issues empty.
            }
          }

          const riskBadge: Record<string, { label: string; cls: string }> = {
            HIGH:   { label: "고위험",   cls: "bg-red-50   text-red-700   ring-red-200"   },
            MEDIUM: { label: "중간위험", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
            LOW:    { label: "저위험",   cls: "bg-green-50 text-green-700 ring-green-200" },
          };
          const badge = analysis.overallRisk ? riskBadge[analysis.overallRisk] : null;

          return (
            <div className="mx-4 mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 space-y-3">
              {/* Header row */}
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 flex-shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">문서 요약</span>
                {badge && (
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
              </div>

              {/* Summary text */}
              <p className="text-sm text-zinc-700 leading-relaxed">{analysis.documentSummary}</p>

              {/* Key issues */}
              {issues.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">주요 이슈</p>
                  <ul className="space-y-1">
                    {issues.slice(0, 5).map((issue, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-400" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })()}

        {/* PDF content — shown when not processing (failed state still shows PDF) */}
        {!isDocumentProcessing && (
          pdfBlobUrl ? (
            <DocumentViewer
              fileUrl={pdfBlobUrl}
              clauseResults={clauseResults}
              selectedClauseId={selectedClauseId}
              onClauseClick={handleClauseClick}
              scrollTargetRef={scrollTargetRef}
            />
          ) : (
            loadState === "success" && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-200">
                  <svg className="h-6 w-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-zinc-500">문서 미리보기를 사용할 수 없습니다</p>
                <p className="mt-1 text-xs text-zinc-400">조항 목록은 사이드바에서 확인할 수 있습니다.</p>
              </div>
            )
          )
        )}

        {/* Loading skeleton for PDF area */}
        {loadState === "loading" && (
          <div className="flex flex-col gap-4 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 overflow-hidden">
                <div className="h-[800px] animate-pulse bg-zinc-100" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Evidence panel (slide-in) */}
      {selectedClauseResult && (
        <EvidencePanel
          clauseResult={selectedClauseResult}
          analysisId={
            analysisState.phase === "done" || analysisState.phase === "polling"
              ? (analysisState as { analysisId: string }).analysisId
              : analysis?.id ?? ""
          }
          contractId={contractId}
          onClose={() => setSelectedClauseResult(null)}
          onOverrideApplied={(overriddenResult) => {
            setClauseResults((prev) =>
              prev.map((r) => (r.id === overriddenResult.id ? overriddenResult : r))
            );
            setSelectedClauseResult(overriddenResult);
          }}
        />
      )}

      {/* Mobile: Clause navigation bottom sheet */}
      {showClauseDrawer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setShowClauseDrawer(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-xl md:hidden"
            style={{ maxHeight: "75vh" }}
          >
            {/* Drag handle + header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="mx-auto h-1 w-8 rounded-full bg-zinc-200" />
                <span className="ml-2 text-sm font-semibold text-zinc-900">조항</span>
                {clauses.length > 0 && (
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 tabular-nums">
                    {clauses.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowClauseDrawer(false)}
                className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="조항 목록 닫기"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Scrollable clause list */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ClauseNav
                clauses={clauses}
                clauseResults={clauseResults}
                selectedClauseId={selectedClauseId}
                onClauseSelect={handleClauseSelect}
              />
            </div>
          </div>
        </>
      )}

      {/* Edit contract modal */}
      {showEditModal && contract && (
        <EditContractModal
          contract={contract}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setContract(updated);
            setShowEditModal(false);
            toast("success", "계약서가 업데이트되었습니다.");
          }}
        />
      )}
    </div>
  );
}
