"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
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
  uploaded: "Uploaded",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_COLOR: Record<string, string> = {
  uploaded: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  processing: "bg-amber-50 text-amber-700 ring-amber-200",
  ready: "bg-green-50 text-green-700 ring-green-200",
  failed: "bg-red-50 text-red-600 ring-red-200",
};

const STATUS_OPTIONS: ContractStatus[] = ["uploaded", "processing", "ready", "failed"];

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

export default function ContractsPage() {
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();
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

  // Search & filter state (raw — user input)
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "">("");

  // Debounced search query — actual API call uses this
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Track whether any filters are active
  const hasActiveFilters = debouncedQuery.trim() !== "" || statusFilter !== "";

  // Ref to track the current fetch to avoid stale closures race conditions
  const fetchIdRef = useRef(0);

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
      toast("error", `Upload failed: ${getErrorMessage(err, "Unknown error")}`);
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
    toast("success", "Document processed and ready for analysis.");
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
      toast("error", `Delete failed: ${getErrorMessage(err, "Unknown error")}`);
    } finally {
      setDeleting(false);
    }
  }

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("");
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Contracts</h1>
          {loadState === "success" && (
            <p className="mt-0.5 text-sm text-zinc-400">
              {total} contract{total !== 1 ? "s" : ""}
              {hasActiveFilters && (
                <span className="ml-1 text-zinc-400">matching current filters</span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className={[
            "cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            showUpload
              ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
              : "bg-zinc-900 text-white hover:bg-zinc-700",
          ].join(" ")}
        >
          {showUpload ? (
            "Cancel"
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload contract
            </>
          )}
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="animate-slide-in rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">Upload a new contract</h2>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Title{" "}
              <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g. NDA with Acme Corp"
              className="w-full rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
          <DropZone onFile={handleFile} disabled={uploading} />
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Uploading…</span>
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
            placeholder="Search by title or filename…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-600"
              aria-label="Clear search"
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
            <option value="">All statuses</option>
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
              Clear
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
          <p className="text-sm font-medium text-red-700">Failed to load contracts.</p>
          <button
            onClick={() => fetchContracts()}
            className="mt-2 text-sm font-medium text-red-800 underline underline-offset-2 hover:no-underline"
          >
            Try again
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
          <p className="text-sm font-medium text-zinc-700">No contracts yet</p>
          <p className="mt-1 text-sm text-zinc-400">
            Upload your first contract to get started.
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="cursor-pointer mt-5 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload contract
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
          <p className="text-sm font-medium text-zinc-700">No contracts match your filters</p>
          <p className="mt-1 text-sm text-zinc-400">Try adjusting your search or status filter.</p>
          <button
            onClick={clearFilters}
            className="cursor-pointer mt-4 text-sm font-medium text-zinc-700 underline underline-offset-2 hover:no-underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Contract list */}
      {loadState === "success" && contracts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          {contracts.map((c, i) => (
            <div
              key={c.id}
              className={[
                "relative flex items-center group",
                i > 0 ? "border-t border-zinc-100" : "",
              ].join(" ")}
            >
              <Link
                href={`/contracts/${c.id}`}
                className="flex flex-1 items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-50 min-w-0"
              >
                {/* File icon */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 transition-colors group-hover:bg-zinc-200">
                  <DocIcon />
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 leading-snug">
                    {c.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400 min-w-0">
                    <span className="truncate">{c.fileName}</span>
                    {c.fileSize ? (
                      <span className="flex-shrink-0 hidden sm:inline">
                        · {formatBytes(c.fileSize)}
                      </span>
                    ) : null}
                    {c.createdAt ? (
                      <span className="flex-shrink-0 hidden md:inline">
                        · {formatDate(c.createdAt)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Expiry badge */}
                {(() => {
                  const expiryStatus = getExpiryStatus(c.expiresAt);
                  if (!expiryStatus) return null;
                  return (
                    <span
                      className={
                        expiryStatus === "expired"
                          ? "flex-shrink-0 hidden sm:inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 bg-red-50 text-red-600 ring-red-200"
                          : "flex-shrink-0 hidden sm:inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 bg-orange-50 text-orange-600 ring-orange-200"
                      }
                    >
                      {expiryStatus === "expired" ? "Expired" : "Expires soon"}
                    </span>
                  );
                })()}

                {/* Status badge */}
                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                    STATUS_COLOR[c.status] ?? "bg-zinc-100 text-zinc-600 ring-zinc-200"
                  }`}
                >
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>

                {/* Chevron */}
                <svg
                  className="h-4 w-4 flex-shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              {/* Delete button (visible on hover) */}
              <button
                onClick={(e) => openDeleteDialog(e, c)}
                className="cursor-pointer mr-4 flex-shrink-0 rounded-md p-1.5 text-zinc-300 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500"
                title="Delete contract"
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
                Loading…
              </span>
            ) : (
              `Load more (${total - contracts.length} remaining)`
            )}
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteDialog.open && (
        <Modal
          onClose={() =>
            !deleting &&
            setDeleteDialog({ open: false, contractId: "", contractTitle: "" })
          }
        >
          <div className="w-full max-w-sm animate-slide-in rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
            <h3 className="text-base font-semibold text-zinc-900">Delete contract?</h3>
            <p className="mt-2 text-sm text-zinc-500">
              <span className="font-medium text-zinc-800">
                &ldquo;{deleteDialog.contractTitle}&rdquo;
              </span>{" "}
              will be permanently deleted. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() =>
                  setDeleteDialog({ open: false, contractId: "", contractTitle: "" })
                }
                disabled={deleting}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
                    Deleting…
                  </span>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
