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

  const applyAnalysisResponse = useCallback(
    (resp: RiskAnalysisResponse, notify?: boolean) => {
      setAnalysis(resp.analysis);
      setClauseResults(resp.clauseResults ?? []);
      if (resp.analysis.status === "completed" || resp.analysis.status === "failed") {
        setAnalysisState({ phase: "done", analysisId: resp.analysis.id });
        if (notify) {
          if (resp.analysis.status === "completed") {
            toast("success", `Analysis complete — ${(resp.clauseResults ?? []).length} clauses reviewed.`);
          } else {
            toast("error", "Analysis failed. Please try again.");
          }
        }
      }
    },
    [toast]
  );

  useEffect(() => {
    let blobUrl: string | null = null;

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
          applyAnalysisResponse(analysisResp);
          if (
            analysisResp.analysis.status === "pending" ||
            analysisResp.analysis.status === "running"
          ) {
            setAnalysisState({ phase: "polling", analysisId: analysisResp.analysis.id });
          }
        } catch {
          // No existing analysis — stay idle.
        }

        const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
        const res = await fetch(`${API_URL}/contracts/${contractId}/file`, {
          headers: {
            Authorization: `Bearer ${
              (await import("@/lib/auth")).useAuthStore.getState().accessToken ?? ""
            }`,
          },
          credentials: "include",
        });
        if (res.ok) {
          const blob = await res.blob();
          blobUrl = URL.createObjectURL(blob);
          setPdfBlobUrl(blobUrl);
        }
      } catch {
        setLoadState("error");
      }
    }
    load();

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setPdfBlobUrl(null);
      }
    };
  }, [contractId, applyAnalysisResponse]);

  useEffect(() => {
    if (analysisState.phase !== "polling") return;
    const { analysisId } = analysisState;
    let timerId: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const resp = await api.getAnalysis(analysisId);
        applyAnalysisResponse(resp, true);
        if (resp.analysis.status === "completed" || resp.analysis.status === "failed") {
          if (timerId) clearInterval(timerId);
        }
      } catch {
        // retry silently
      }
    }

    poll();
    timerId = setInterval(poll, 2000);

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [analysisState, applyAnalysisResponse]);

  async function handleRequestAnalysis() {
    setAnalysisState({ phase: "requesting" });
    try {
      const resp = await api.createAnalysis(contractId);
      setAnalysisState({ phase: "polling", analysisId: resp.analysisId });
    } catch (err: unknown) {
      toast("error", `Failed to start analysis: ${err instanceof Error ? err.message : "Unknown error"}`);
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
  }

  function handleClauseClick(result: ClauseResult) {
    setSelectedClauseResult(result);
    setSelectedClauseId(result.clauseId);
  }

  const isAnalysisRunning =
    analysisState.phase === "requesting" ||
    analysisState.phase === "polling" ||
    analysis?.status === "running";

  function analysisButtonLabel() {
    if (analysisState.phase === "requesting") return "Starting…";
    if (analysisState.phase === "polling") return "Analyzing…";
    return "Run AI Analysis";
  }

  const showReanalyzeButton =
    !isAnalysisRunning &&
    (analysis?.status === "completed" || analysis?.status === "failed") &&
    loadState === "success";

  if (loadState === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-900">Failed to load contract</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left: Clause navigation */}
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
              <span className="hidden text-xs sm:inline">Contracts</span>
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
            {analysis?.status === "completed" && (
              <span className="text-xs text-zinc-400 hidden sm:inline tabular-nums">
                {clauseResults.length} clauses
              </span>
            )}
            {analysis?.status === "failed" && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-red-200 hidden sm:inline-flex">
                Failed
              </span>
            )}
            {(analysisState.phase === "polling" || analysis?.status === "running") && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-400" />
                Analyzing
              </span>
            )}

            {loadState === "success" && (
              <button
                onClick={() => setShowEditModal(true)}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                title="Edit contract metadata"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}

            {showReanalyzeButton ? (
              <button
                onClick={handleRequestAnalysis}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                title="Re-run AI analysis"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden sm:inline">Re-analyze</span>
              </button>
            ) : (
              <button
                onClick={handleRequestAnalysis}
                disabled={isAnalysisRunning || loadState !== "success"}
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

        {/* PDF content */}
        {pdfBlobUrl ? (
          <DocumentViewer
            fileUrl={pdfBlobUrl}
            clauseResults={clauseResults}
            onClauseClick={handleClauseClick}
            scrollTargetRef={scrollTargetRef}
          />
        ) : (
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
            <p className="text-sm font-medium text-zinc-500">Document preview not available</p>
            <p className="mt-1 text-xs text-zinc-400">The clauses are listed in the sidebar.</p>
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

      {/* Edit contract modal */}
      {showEditModal && contract && (
        <EditContractModal
          contract={contract}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setContract(updated);
            setShowEditModal(false);
            toast("success", "Contract updated.");
          }}
        />
      )}
    </div>
  );
}
