"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Contract, IngestionJob } from "@/types";
import DropZone from "@/components/upload/DropZone";
import IngestionProgress from "@/components/upload/IngestionProgress";

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
  uploaded: "bg-zinc-100 text-zinc-600",
  processing: "bg-amber-50 text-amber-700",
  ready: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-600",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ContractsPage() {
  const user = useAuthStore((s) => s.user);

  const orgId = user?.organizationId ?? "";

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">(
    "loading"
  );

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

  const fetchContracts = useCallback(async () => {
    if (!orgId) return;
    setLoadState("loading");
    try {
      const data = await api.listContracts(orgId);
      setContracts(data.contracts ?? []);
      setTotal(data.total);
      setLoadState("success");
    } catch {
      setLoadState("error");
    }
  }, [orgId]);

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
    } catch (err: unknown) {
      alert(
        `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setUploading(false);
      setUploadPercent(0);
    }
  }

  function handleIngestionComplete(jobId: string, job: IngestionJob) {
    setActiveUploads((prev) =>
      prev.map((u) => (u.jobId === jobId ? { ...u, done: true } : u))
    );
    // Refresh list after ingestion completes
    fetchContracts();
    void job;
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
      fetchContracts();
    } catch (err: unknown) {
      alert(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Contracts</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {total} contract{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Upload contract
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">
            Upload a new contract
          </h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Title (optional)
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g. NDA with Acme Corp"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <DropZone onFile={handleFile} disabled={uploading} />
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Uploading…</span>
                <span>{uploadPercent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
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
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm space-y-2"
              >
                <p className="text-sm font-medium text-zinc-800">{u.fileName}</p>
                <IngestionProgress
                  jobId={u.jobId}
                  onComplete={(job) => handleIngestionComplete(u.jobId, job)}
                  onError={() =>
                    setActiveUploads((prev) =>
                      prev.map((x) =>
                        x.jobId === u.jobId ? { ...x, done: true } : x
                      )
                    )
                  }
                />
              </div>
            ))}
        </div>
      )}

      {/* Contract list */}
      {loadState === "loading" && (
        <div className="flex items-center justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
        </div>
      )}

      {loadState === "error" && (
        <div className="rounded-lg bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-200">
          Failed to load contracts.{" "}
          <button
            onClick={fetchContracts}
            className="font-medium underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {loadState === "success" && contracts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-400">
          <svg
            className="mb-4 h-12 w-12"
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
          <p className="text-base font-medium">No contracts yet</p>
          <p className="mt-1 text-sm">Upload your first contract to get started.</p>
        </div>
      )}

      {loadState === "success" && contracts.length > 0 && (
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          {contracts.map((c) => (
            <div key={c.id} className="relative flex items-center group">
              <Link
                href={`/contracts/${c.id}`}
                className="flex flex-1 items-center gap-4 px-6 py-4 hover:bg-zinc-50 transition-colors min-w-0"
              >
                {/* Icon */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                  <svg
                    className="h-5 w-5 text-zinc-500"
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
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {c.title}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {c.fileName} · {formatBytes(c.fileSize)} · {formatDate(c.createdAt)}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_COLOR[c.status] ?? "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>

                {/* Arrow */}
                <svg
                  className="h-4 w-4 flex-shrink-0 text-zinc-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>

              {/* Delete button (visible on hover) */}
              <button
                onClick={(e) => openDeleteDialog(e, c)}
                className="mr-4 flex-shrink-0 rounded-md p-1.5 text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                title="Delete contract"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Delete contract?</h3>
            <p className="mt-2 text-sm text-zinc-500">
              <span className="font-medium text-zinc-800">&ldquo;{deleteDialog.contractTitle}&rdquo;</span> will be
              permanently deleted. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteDialog({ open: false, contractId: "", contractTitle: "" })}
                disabled={deleting}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
