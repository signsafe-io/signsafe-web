"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/primitives";
import { getErrorMessage } from "@/lib/utils";
import type { Contract, UpdateContractRequest } from "@/types";

interface EditContractModalProps {
  contract: Contract;
  onClose: () => void;
  onSaved: (updated: Contract) => void;
}

const inputCls =
  "w-full rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50";

const labelCls = "mb-1.5 block text-sm font-medium text-zinc-700";

export default function EditContractModal({
  contract,
  onClose,
  onSaved,
}: EditContractModalProps) {
  const [form, setForm] = useState<UpdateContractRequest>({
    title: contract.title,
    tags: contract.tags,
    parties: contract.parties,
    language: contract.language,
    contractType: contract.contractType ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!form.title?.trim()) {
      setError("Title cannot be empty.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: UpdateContractRequest = {};
      if (form.title !== undefined) payload.title = form.title.trim();
      if (form.tags !== undefined) payload.tags = form.tags;
      if (form.parties !== undefined) payload.parties = form.parties;
      if (form.language !== undefined) payload.language = form.language;
      if (form.contractType) payload.contractType = form.contractType;

      const updated = await api.updateContract(contract.id, payload);
      onSaved(updated);
    } catch (err: unknown) {
      setError(`Failed to save: ${getErrorMessage(err, "Unknown error")}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={saving ? undefined : onClose}>
      <div className="w-full max-w-md animate-slide-in rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900">Edit contract</h3>
          <button
            onClick={saving ? undefined : onClose}
            disabled={saving}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>Title</label>
            <input
              type="text"
              value={form.title ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={inputCls}
              placeholder="e.g. NDA with Acme Corp"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Language</label>
              <input
                type="text"
                value={form.language ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                placeholder="e.g. ko, en"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Contract type</label>
              <input
                type="text"
                value={form.contractType ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, contractType: e.target.value }))}
                placeholder="e.g. NDA"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>
              Tags{" "}
              <span className="text-xs font-normal text-zinc-400">(JSON array)</span>
            </label>
            <input
              type="text"
              value={form.tags ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder='["tag1","tag2"]'
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Parties{" "}
              <span className="text-xs font-normal text-zinc-400">(JSON array)</span>
            </label>
            <input
              type="text"
              value={form.parties ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, parties: e.target.value }))}
              placeholder='["Party A","Party B"]'
              className={inputCls}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
                Saving…
              </span>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
