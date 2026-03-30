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
  UpdateContractRequest,
} from "@/types";
import ClauseNav from "@/components/viewer/ClauseNav";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ui/Toast";

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
  const { toast } = useToast();

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

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState<UpdateContractRequest>({});
  const [editError, setEditError] = useState<string | null>(null);

  // ─── Apply analysis response (defined before useEffects that depend on it) ──

  const applyAnalysisResponse = useCallback(
    (resp: RiskAnalysisResponse, notify = false) => {
      setAnalysis(resp.analysis);
      setClauseResults(resp.clauseResults ?? []);
      if (
        resp.analysis.status === "completed" ||
        resp.analysis.status === "failed"
      ) {
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

  // ─── Load contract + clauses + existing analysis ────────────────────────────

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

        // Load existing analysis if any (404 = none, which is fine).
        try {
          const analysisResp = await api.getLatestAnalysis(contractId);
          applyAnalysisResponse(analysisResp);
          // If the analysis is still running, start polling to pick it up.
          if (
            analysisResp.analysis.status === "pending" ||
            analysisResp.analysis.status === "running"
          ) {
            setAnalysisState({
              phase: "polling",
              analysisId: analysisResp.analysis.id,
            });
          }
        } catch {
          // No existing analysis — stay idle.
        }

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
  }, [contractId, applyAnalysisResponse]);

  // ─── Poll analysis status ────────────────────────────────────────────────────

  useEffect(() => {
    if (analysisState.phase !== "polling") return;
    const { analysisId } = analysisState;

    let timerId: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const resp = await api.getAnalysis(analysisId);
        applyAnalysisResponse(resp, true);
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

  // ─── Edit contract ───────────────────────────────────────────────────────────

  function openEditModal() {
    if (!contract) return;
    setEditError(null);
    setEditForm({
      title: contract.title,
      tags: contract.tags,
      parties: contract.parties,
      language: contract.language,
      contractType: contract.contractType ?? "",
    });
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    // Client-side validation: title must not be blank.
    if (!editForm.title?.trim()) {
      setEditError("Title cannot be empty.");
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const payload: UpdateContractRequest = {};
      if (editForm.title !== undefined) payload.title = editForm.title.trim();
      if (editForm.tags !== undefined) payload.tags = editForm.tags;
      if (editForm.parties !== undefined) payload.parties = editForm.parties;
      if (editForm.language !== undefined) payload.language = editForm.language;
      if (editForm.contractType !== undefined && editForm.contractType !== "")
        payload.contractType = editForm.contractType;

      const updated = await api.updateContract(contractId, payload);
      setContract(updated);
      setShowEditModal(false);
      toast("success", "Contract updated.");
    } catch (err: unknown) {
      setEditError(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setEditSaving(false);
    }
  }

  // ─── Trigger analysis ───────────────────────────────────────────────────────

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
    return "AI Risk Analysis";
  };

  // Show "Re-analyze" when a previous analysis exists and is completed or failed,
  // AND no new analysis is currently in flight.
  const showReanalyzeButton =
    !isAnalysisRunning &&
    (analysis?.status === "completed" || analysis?.status === "failed") &&
    loadState === "success";

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

            {loadState === "success" && (
              <button
                onClick={openEditModal}
                className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}

            {showReanalyzeButton ? (
              <button
                onClick={handleRequestAnalysis}
                className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Re-analyze
              </button>
            ) : (
              <button
                onClick={handleRequestAnalysis}
                disabled={isAnalysisRunning || loadState !== "success"}
                className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAnalysisRunning && (
                  <div className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
                )}
                {analysisButtonLabel()}
              </button>
            )}
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

      {/* ── Edit contract modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Edit contract</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Title</label>
                <input
                  type="text"
                  value={editForm.title ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Language</label>
                <input
                  type="text"
                  value={editForm.language ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, language: e.target.value }))}
                  placeholder="e.g. ko, en"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Contract type</label>
                <input
                  type="text"
                  value={editForm.contractType ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, contractType: e.target.value }))}
                  placeholder="e.g. NDA, Service Agreement"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Tags (JSON array)</label>
                <input
                  type="text"
                  value={editForm.tags ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder='["tag1","tag2"]'
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Parties (JSON array)</label>
                <input
                  type="text"
                  value={editForm.parties ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, parties: e.target.value }))}
                  placeholder='["Party A","Party B"]'
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
            </div>
            {editError && (
              <p className="mt-3 text-sm text-red-600">{editError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowEditModal(false)}
                disabled={editSaving}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
