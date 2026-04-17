"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import { useDebounce } from "@/lib/useDebounce";
import type { Contract, ContractStatus, IngestionJob } from "@/types";
import DropZone from "@/components/upload/DropZone";
import IngestionProgress from "@/components/upload/IngestionProgress";
import { useToast } from "@/components/ui/Toast";
import { Modal, LoadingSpinner } from "@/components/ui/primitives";
import { getErrorMessage, formatBytes, formatDate, getExpiryStatus } from "@/lib/utils";

interface DeleteDialogState {
  open: boolean;
  contractId: string;
  contractTitle: string;
}

interface ActiveUpload {
  fileName: string;
  contractId: string;
  jobId: string;
  done: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  uploaded: "업로드됨",
  processing: "처리 중",
  ready: "준비 완료",
  failed: "실패",
};

const STATUS_COLOR: Record<string, string> = {
  uploaded: "text-zinc-600 ring-zinc-300",
  processing: "text-amber-700 ring-amber-300",
  ready: "text-green-600 ring-green-400",
  failed: "text-red-500 ring-red-300",
};

const STATUS_OPTIONS: ContractStatus[] = ["uploaded", "processing", "ready", "failed"];

const RISK_BADGE: Record<string, { label: string; cls: string }> = {
  HIGH:   { label: "고위험",   cls: "bg-red-50   text-red-700   ring-red-200"   },
  MEDIUM: { label: "중간위험", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  LOW:    { label: "저위험",   cls: "bg-green-50 text-green-700 ring-green-200" },
};

const PAGE_SIZE = 20;

function DocIcon() {
  return (
    <svg
      className="h-4 w-4 text-zinc-400"
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
  );
}

function ContractsPageInner() {
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = user?.organizationId ?? "";

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadMoreState, setLoadMoreState] = useState<"idle" | "loading">("idle");
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
  const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadTitle, setUploadTitle] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    contractId: "",
    contractTitle: "",
  });
  const [deleting, setDeleting] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ done: 0, total: 0 });

  // Search & filter state — initialised from URL search params
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "">(
    () => (searchParams.get("status") as ContractStatus | null) ?? ""
  );

  // Debounced search query — actual API call uses this
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Track whether any filters are active
  const hasActiveFilters = debouncedQuery.trim() !== "" || statusFilter !== "";

  // Ref to track the current fetch to avoid stale closures race conditions
  const fetchIdRef = useRef(0);

  // Keep URL in sync whenever filter state changes.
  // We use router.replace so the filter navigation doesn't pollute the history stack.
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (statusFilter) params.set("status", statusFilter);

    const queryString = params.toString();
    const newPath = queryString ? `/contracts?${queryString}` : "/contracts";
    router.replace(newPath);
  }, [searchQuery, statusFilter, router]);

  const fetchContracts = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!orgId) return;
      const fetchId = ++fetchIdRef.current;

      if (!opts?.silent) setLoadState("loading");
      setPage(1);

      try {
        const data = await api.listContracts(orgId, {
          page: 1,
          pageSize: PAGE_SIZE,
          q: debouncedQuery.trim() || undefined,
          status: statusFilter || undefined,
        });

        // Ignore stale responses
        if (fetchId !== fetchIdRef.current) return;

        setContracts(data.contracts ?? []);
        setTotal(data.total);
        setLoadState("success");
        setSelectedIds(new Set()); // clear selection on refresh
      } catch {
        if (fetchId !== fetchIdRef.current) return;
        setLoadState("error");
      }
    },
    [orgId, debouncedQuery, statusFilter]
  );

  const loadMore = useCallback(async () => {
    if (!orgId || loadMoreState === "loading") return;
    const nextPage = page + 1;
    setLoadMoreState("loading");
    try {
      const data = await api.listContracts(orgId, {
        page: nextPage,
        pageSize: PAGE_SIZE,
        q: debouncedQuery.trim() || undefined,
        status: statusFilter || undefined,
      });
      setContracts((prev) => [...prev, ...(data.contracts ?? [])]);
      setTotal(data.total);
      setPage(nextPage);
    } finally {
      setLoadMoreState("idle");
    }
  }, [orgId, page, loadMoreState, debouncedQuery, statusFilter]);

  // Re-fetch when debounced query or status filter changes
  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadPercent(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("organizationId", orgId);
      if (uploadTitle) formData.append("title", uploadTitle);

      const result = await api.uploadContractWithProgress(formData, setUploadPercent);
      setActiveUploads((prev) => [
        ...prev,
        {
          fileName: uploadTitle || file.name,
          contractId: result.contractId,
          jobId: result.jobId,
          done: false,
        },
      ]);
      setUploadTitle("");
      setShowUpload(false);
      fetchContracts({ silent: true });
    } catch (err: unknown) {
      toast("error", `업로드 실패: ${getErrorMessage(err, "알 수 없는 오류")}`);
    } finally {
      setUploading(false);
      setUploadPercent(0);
    }
  }

  function handleIngestionComplete(jobId: string, _job: IngestionJob) {
    setActiveUploads((prev) =>
      prev.map((u) => (u.jobId === jobId ? { ...u, done: true } : u))
    );
    fetchContracts({ silent: true });
    toast("success", "문서 처리가 완료되어 분석할 준비가 됐습니다.");
  }

  function openDeleteDialog(e: React.MouseEvent, contract: Contract) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteDialog({ open: true, contractId: contract.id, contractTitle: contract.title });
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await api.deleteContract(deleteDialog.contractId);
      setDeleteDialog({ open: false, contractId: "", contractTitle: "" });
      fetchContracts({ silent: true });
    } catch (err: unknown) {
      toast("error", `삭제 실패: ${getErrorMessage(err, "알 수 없는 오류")}`);
    } finally {
      setDeleting(false);
    }
  }

  // Bulk selection helpers
  const allVisibleSelected =
    contracts.length > 0 && contracts.every((c) => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contracts.map((c) => c.id)));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    setBulkDeleting(true);
    setBulkDeleteProgress({ done: 0, total: ids.length });
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      try {
        await api.deleteContract(ids[i]);
      } catch {
        failed++;
      }
      setBulkDeleteProgress({ done: i + 1, total: ids.length });
    }
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds(new Set());
    fetchContracts({ silent: true });
    if (failed > 0) {
      toast("error", `${failed}개 계약서를 삭제하지 못했습니다.`);
    } else {
      toast("success", `${ids.length}개 계약서가 삭제됐습니다.`);
    }
  }

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("");
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-zinc-900">계약서</h1>
          {loadState === "success" && (
            <p className="mt-0.5 text-sm text-zinc-400">
              총 {total}건
              {hasActiveFilters && (
                <span className="ml-1 text-zinc-400">현재 필터 조건 기준</span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className={[
            "cursor-pointer inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
            showUpload
              ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
              : "bg-blue-600 text-white hover:bg-blue-700",
          ].join(" ")}
        >
          {showUpload ? (
            "취소"
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              계약서 업로드
            </>
          )}
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="animate-slide-in rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">새 계약서 업로드</h2>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              제목{" "}
              <span className="font-normal text-zinc-400">(선택)</span>
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="예: Acme Corp NDA"
              className="w-full rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
          <DropZone onFile={handleFile} disabled={uploading} />
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>업로드 중&hellip;</span>
                <span className="font-medium tabular-nums">{uploadPercent}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-zinc-700 transition-all duration-150"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active ingestion jobs */}
      {activeUploads.filter((u) => !u.done).length > 0 && (
        <div className="space-y-3">
          {activeUploads
            .filter((u) => !u.done)
            .map((u) => (
              <div
                key={u.jobId}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                    <DocIcon />
                  </div>
                  <p className="text-sm font-medium text-zinc-800">{u.fileName}</p>
                </div>
                <IngestionProgress
                  jobId={u.jobId}
                  onComplete={(job) => handleIngestionComplete(u.jobId, job)}
                  onError={() => {
                    setActiveUploads((prev) =>
                      prev.map((x) =>
                        x.jobId === u.jobId ? { ...x, done: true } : x
                      )
                    );
                    fetchContracts({ silent: true });
                  }}
                />
              </div>
            ))}
        </div>
      )}

      {/* Search & filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제목 또는 파일명으로 검색&hellip;"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-600"
              aria-label="검색 초기화"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContractStatus | "")}
            className="rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-8 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="">전체 상태</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="cursor-pointer rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 whitespace-nowrap"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loadState === "loading" && (
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner size="md" />
        </div>
      )}

      {/* Error */}
      {loadState === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">계약서를 불러오지 못했습니다.</p>
          <button
            onClick={() => fetchContracts()}
            className="mt-2 text-sm font-medium text-red-800 underline underline-offset-2 hover:no-underline"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Empty state — no contracts at all */}
      {loadState === "success" && contracts.length === 0 && !hasActiveFilters && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <svg className="h-6 w-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-700">계약서가 없습니다</p>
          <p className="mt-1 text-sm text-zinc-400">
            첫 번째 계약서를 업로드해 시작하세요.
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="cursor-pointer mt-5 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            계약서 업로드
          </button>
        </div>
      )}

      {/* Empty state — filter returned no results */}
      {loadState === "success" && contracts.length === 0 && hasActiveFilters && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-16 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
            <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-700">필터 조건에 맞는 계약서가 없습니다</p>
          <p className="mt-1 text-sm text-zinc-400">검색어나 상태 필터를 조정해보세요.</p>
          <button
            onClick={clearFilters}
            className="cursor-pointer mt-4 text-sm font-medium text-zinc-700 underline underline-offset-2 hover:no-underline"
          >
            필터 초기화
          </button>
        </div>
      )}

      {/* Contract list */}
      {loadState === "success" && contracts.length > 0 && (
        <div className="space-y-2">
          {/* Select-all row */}
          <div className="flex items-center gap-3 px-1 pb-1">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="cursor-pointer h-4 w-4 rounded border-zinc-300 accent-blue-600"
              aria-label="모든 계약서 선택"
            />
            <span className="text-xs font-medium text-zinc-400">
              {someSelected
                ? `${selectedIds.size}개 선택됨`
                : `총 ${contracts.length}건`}
            </span>
          </div>

          {contracts.map((c) => (
            <div
              key={c.id}
              className={[
                "group relative flex items-center rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md",
                selectedIds.has(c.id) ? "ring-2 ring-blue-200" : "",
              ].join(" ")}
            >
              {/* Checkbox */}
              <div className="pl-4 pr-2 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onChange={() => toggleSelectOne(c.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer h-4 w-4 rounded border-zinc-300 accent-blue-600"
                  aria-label={`Select ${c.title}`}
                />
              </div>

              <Link
                href={`/contracts/${c.id}`}
                className="flex flex-1 items-center gap-4 px-3 py-4 min-w-0"
              >
                {/* Title + extension */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900 leading-snug">
                    {c.title}
                    {c.fileName && (
                      <span className="ml-1 text-xs font-normal text-zinc-400">
                        .{c.fileName.split(".").pop()?.toUpperCase() ?? "PDF"}
                      </span>
                    )}
                  </p>
                  {c.fileSize ? (
                    <p className="mt-0.5 text-xs text-zinc-400 hidden sm:block">
                      {formatBytes(c.fileSize)}
                    </p>
                  ) : null}
                </div>

                {/* Right side: expiry, status, date */}
                <div className="flex flex-shrink-0 items-center gap-3">
                {/* Expiry badge */}
                {(() => {
                  const expiryStatus = getExpiryStatus(c.expiresAt);
                  if (!expiryStatus) return null;
                  return (
                    <span
                      className={
                        expiryStatus === "expired"
                          ? "hidden sm:inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 text-red-600 ring-red-300"
                          : "hidden sm:inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 text-orange-600 ring-orange-300"
                      }
                    >
                      {expiryStatus === "expired" ? "만료됨" : "곧 만료"}
                    </span>
                  );
                })()}

                {/* Analysis risk badge */}
                {c.latestAnalysisRisk && RISK_BADGE[c.latestAnalysisRisk] && (
                  <span
                    className={`flex-shrink-0 hidden sm:inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${RISK_BADGE[c.latestAnalysisRisk].cls}`}
                  >
                    {RISK_BADGE[c.latestAnalysisRisk].label}
                  </span>
                )}

                {/* Status badge */}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                    STATUS_COLOR[c.status] ?? "text-zinc-600 ring-zinc-300"
                  }`}
                >
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>

                  {c.createdAt && (
                    <span className="hidden md:block text-xs text-zinc-400">
                      {formatDate(c.createdAt)}
                    </span>
                  )}
                </div>
              </Link>

              {/* Delete button (visible on hover) */}
              <button
                onClick={(e) => openDeleteDialog(e, c)}
                className="cursor-pointer mr-3 flex-shrink-0 rounded-lg p-1.5 text-zinc-300 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500"
                title="계약서 삭제"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bulk action bar — slides up when something is selected */}
      {someSelected && loadState === "success" && (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 animate-slide-in">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-3 shadow-lg ring-1 ring-zinc-200">
            <span className="text-sm font-medium text-zinc-700">
              {selectedIds.size}개 선택됨
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="cursor-pointer text-xs text-zinc-400 transition-colors hover:text-zinc-600"
            >
              선택 해제
            </button>
            <div className="h-4 w-px bg-zinc-200" />
            <button
              onClick={() => setBulkDeleteOpen(true)}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              선택 삭제
            </button>
          </div>
        </div>
      )}

      {/* Load more */}
      {loadState === "success" && contracts.length < total && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadMoreState === "loading"}
            className="cursor-pointer rounded-lg border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadMoreState === "loading" ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                로딩 중&hellip;
              </span>
            ) : (
              `더 보기 (${total - contracts.length}건 남음)`
            )}
          </button>
        </div>
      )}

      {/* Single delete confirmation dialog */}
      {deleteDialog.open && (
        <Modal
          onClose={() =>
            !deleting &&
            setDeleteDialog({ open: false, contractId: "", contractTitle: "" })
          }
        >
          <div className="w-full max-w-sm animate-slide-in rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
            <h3 className="text-base font-semibold text-zinc-900">계약서를 삭제할까요?</h3>
            <p className="mt-2 text-sm text-zinc-500">
              <span className="font-medium text-zinc-800">
                &ldquo;{deleteDialog.contractTitle}&rdquo;
              </span>{" "}
              이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() =>
                  setDeleteDialog({ open: false, contractId: "", contractTitle: "" })
                }
                disabled={deleting}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
                    삭제 중&hellip;
                  </span>
                ) : (
                  "삭제"
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk delete confirmation dialog */}
      {bulkDeleteOpen && (
        <Modal onClose={() => !bulkDeleting && setBulkDeleteOpen(false)}>
          <div className="w-full max-w-sm animate-slide-in rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
            <h3 className="text-base font-semibold text-zinc-900">
              {selectedIds.size}개 계약서를 삭제할까요?
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              선택한 계약서가 영구적으로 삭제됩니다.
              이 작업은 되돌릴 수 없습니다.
            </p>
            {bulkDeleting && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>삭제 중&hellip;</span>
                  <span className="tabular-nums">
                    {bulkDeleteProgress.done} / {bulkDeleteProgress.total}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all duration-150"
                    style={{
                      width: `${(bulkDeleteProgress.done / bulkDeleteProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setBulkDeleteOpen(false)}
                disabled={bulkDeleting}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {bulkDeleting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
                    삭제 중&hellip;
                  </span>
                ) : (
                  `${selectedIds.size}개 삭제`
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function ContractsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="md" />
      </div>
    }>
      <ContractsPageInner />
    </Suspense>
  );
}
