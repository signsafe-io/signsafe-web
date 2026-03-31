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

  const inputCls =
    "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
  const labelCls = "mb-1 block text-xs font-medium text-zinc-600";

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
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-zinc-900">Edit contract</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className={labelCls}>Title</label>
            <input
              type="text"
              value={form.title ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={inputCls}
            />
          </div>
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
              placeholder="e.g. NDA, Service Agreement"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Tags (JSON array)</label>
            <input
              type="text"
              value={form.tags ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder='["tag1","tag2"]'
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Parties (JSON array)</label>
            <input
              type="text"
              value={form.parties ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, parties: e.target.value }))}
              placeholder='["Party A","Party B"]'
              className={inputCls}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
