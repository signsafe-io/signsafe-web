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
import dynamic from "next/dynamic";

// Dynamically import the DocumentViewer to avoid SSR issues with react-pdf.
const DocumentViewer = dynamic(
  () => import("@/components/viewer/DocumentViewer"),
  { ssr: false }
);

// Dynamically import the EvidencePanel.
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

  // Scroll target map: page-{n} → div element
  const scrollTargetRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Core data
  const [contract, setContract] = useState<Contract | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [clauseResults, setClauseResults] = useState<ClauseResult[]>([]);
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);

  const [loadState, setLoadState] = useState<"loading" | "success" | "error">(
    "loading"
  );

  // Analysis workflow
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    phase: "idle",
  });

  // Evidence panel
  const [selectedClauseResult, setSelectedClauseResult] =
    useState<ClauseResult | null>(null);
  const [selectedClauseId, setSelectedClauseId] = useState<string | undefined>(
    undefined
  );

  // PDF blob URL (fetched with auth token to avoid 401)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // ─── Load contract + clauses ────────────────────────────────────────────────

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

        // Fetch PDF with auth token and create a blob URL for react-pdf.
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
  }, [contractId]);

  // ─── Poll analysis status ────────────────────────────────────────────────────

  const applyAnalysisResponse = useCallback((resp: RiskAnalysisResponse) => {
    setAnalysis(resp.analysis);
    setClauseResults(resp.clauseResults ?? []);
    if (
      resp.analysis.status === "completed" ||
      resp.analysis.status === "failed"
    ) {
      setAnalysisState({ phase: "done", analysisId: resp.analysis.id });
    }
  }, []);

  useEffect(() => {
    if (analysisState.phase !== "polling") return;
    const { analysisId } = analysisState;

    let timerId: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const resp = await api.getAnalysis(analysisId);
        applyAnalysisResponse(resp);
        if (
          resp.analysis.status === "completed" ||
          resp.analysis.status === "failed"
        ) {
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

  // ─── Trigger analysis ───────────────────────────────────────────────────────

  async function handleRequestAnalysis() {
    setAnalysisState({ phase: "requesting" });
    try {
      const resp = await api.createAnalysis(contractId);
      setAnalysisState({ phase: "polling", analysisId: resp.analysisId });
    } catch (err: unknown) {
      alert(
        `Failed to start analysis: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      setAnalysisState({ phase: "idle" });
    }
  }

  // ─── Navigate to clause ─────────────────────────────────────────────────────

  function handleClauseSelect(clause: Clause) {
    setSelectedClauseId(clause.id);
    // Scroll the document viewer to the clause's page.
    const pageKey = `page-${clause.pageStart}`;
    const el = scrollTargetRef.current.get(pageKey);
    if (el && scrollContainerRef.current) {
      const top =
        el.offsetTop - (scrollContainerRef.current.offsetTop ?? 0) - 16;
      scrollContainerRef.current.scrollTo({ top, behavior: "smooth" });
    }
  }

  function handleClauseClick(result: ClauseResult) {
    setSelectedClauseResult(result);
    setSelectedClauseId(result.clauseId);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const isAnalysisRunning =
    analysisState.phase === "requesting" ||
    analysisState.phase === "polling" ||
    analysis?.status === "running";

  const analysisButtonLabel = () => {
    if (analysisState.phase === "requesting") return "Starting…";
    if (analysisState.phase === "polling") return "Analyzing…";
    if (analysis?.status === "completed") return "Analysis complete";
    return "AI Risk Analysis";
  };

  // Use the authenticated blob URL for the PDF viewer.
  const pdfUrl = pdfBlobUrl;

  if (loadState === "error") {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-red-600">
        Failed to load contract.{" "}
        <button onClick={() => router.back()} className="ml-1 underline">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ── Left: Clause navigation ── */}
      <aside className="w-72 flex-shrink-0 overflow-y-auto border-r border-zinc-200 bg-white">
        {loadState === "loading" ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
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

      {/* ── Center: Document viewer ── */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-y-auto bg-zinc-100"
      >
        {/* Toolbar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2">
          <div>
            <button
              onClick={() => router.push("/contracts")}
              className="mr-2 text-sm text-zinc-500 hover:text-zinc-900"
            >
              ← Contracts
            </button>
            {contract && (
              <span className="text-sm font-medium text-zinc-800">
                {contract.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {analysis?.status === "completed" && (
              <span className="text-xs text-zinc-400">
                {clauseResults.length} clauses analyzed
              </span>
            )}
            {analysis?.status === "failed" && (
              <span className="text-xs text-red-500">Analysis failed</span>
            )}

            <button
              onClick={handleRequestAnalysis}
              disabled={
                isAnalysisRunning ||
                analysis?.status === "completed" ||
                loadState !== "success"
              }
              className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalysisRunning && (
                <div className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
              )}
              {analysisButtonLabel()}
            </button>
          </div>
        </div>

        {/* PDF content */}
        {pdfUrl ? (
          <DocumentViewer
            fileUrl={pdfUrl}
            clauseResults={clauseResults}
            onClauseClick={handleClauseClick}
            scrollTargetRef={scrollTargetRef}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-sm text-zinc-400">
            <svg
              className="mb-3 h-10 w-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p>Document preview not available</p>
            <p className="mt-1 text-xs">The clauses are listed in the sidebar.</p>
          </div>
        )}
      </div>

      {/* ── Right: Evidence panel (slide-in) ── */}
      {selectedClauseResult && (
        <EvidencePanel
          clauseResult={selectedClauseResult}
          analysisId={analysisState.phase === "done" || analysisState.phase === "polling"
            ? (analysisState as { analysisId: string }).analysisId
            : analysis?.id ?? ""}
          contractId={contractId}
          onClose={() => setSelectedClauseResult(null)}
          onOverrideApplied={(overriddenResult) => {
            setClauseResults((prev) =>
              prev.map((r) =>
                r.id === overriddenResult.id ? overriddenResult : r
              )
            );
            setSelectedClauseResult(overriddenResult);
          }}
        />
      )}
    </div>
  );
}
