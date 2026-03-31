"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { OrganizationSummary } from "@/types";

// ─────────────────────────────────────────────
// New Org Modal
// ─────────────────────────────────────────────

interface NewOrgModalProps {
  onClose: () => void;
  onCreated: (org: OrganizationSummary) => void;
}

function NewOrgModal({ onClose, onCreated }: NewOrgModalProps) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setStatus("loading");
    setErrorMsg(null);
    try {
      const org = await api.createOrganization(trimmed);
      onCreated({ id: org.id, name: org.name, plan: org.plan, role: "admin" });
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to create organization");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-zinc-900">
          New Organization
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="org-name" className="text-sm font-medium text-zinc-700">
              Organization name
            </label>
            <input
              id="org-name"
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              maxLength={100}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
              disabled={status === "loading"}
            />
            {errorMsg && (
              <p className="text-xs text-red-600">{errorMsg}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === "loading" || name.trim().length === 0}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {status === "loading" ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// OrgSwitcher dropdown
// ─────────────────────────────────────────────

export function OrgSwitcher() {
  const { user, switchOrganization } = useAuthStore();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "error">("idle");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const loadOrgs = useCallback(async () => {
    setLoadStatus("loading");
    try {
      const data = await api.listMyOrganizations();
      setOrgs(data);
      setLoadStatus("idle");
    } catch {
      setLoadStatus("error");
    }
  }, []);

  function handleOpen() {
    setOpen((prev) => {
      if (!prev) loadOrgs();
      return !prev;
    });
  }

  function handleSelect(org: OrganizationSummary) {
    switchOrganization(org.id, org.name);
    setOpen(false);
  }

  function handleCreated(org: OrganizationSummary) {
    setOrgs((prev) => [...prev, org]);
    switchOrganization(org.id, org.name);
    setShowModal(false);
    setOpen(false);
    toast("success", "Organization created");
  }

  const currentOrgName = user?.organizationName;
  const currentOrgId = user?.organizationId;

  if (!currentOrgName) return null;

  return (
    <>
      <div ref={dropdownRef} className="relative hidden sm:block">
        <button
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 border border-zinc-200 hover:bg-zinc-200 transition-colors"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {currentOrgName}
          <svg
            className={`h-3 w-3 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute left-0 top-full mt-1.5 w-56 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg z-40"
          >
            {loadStatus === "loading" && (
              <p className="px-3 py-2 text-xs text-zinc-400">Loading...</p>
            )}
            {loadStatus === "error" && (
              <p className="px-3 py-2 text-xs text-red-500">Failed to load organizations</p>
            )}
            {loadStatus === "idle" && orgs.length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-400">No organizations found</p>
            )}
            {loadStatus === "idle" && orgs.map((org) => {
              const isActive = org.id === currentOrgId;
              return (
                <button
                  key={org.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(org)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  <span className="truncate">{org.name}</span>
                  {isActive && (
                    <svg className="ml-2 h-4 w-4 flex-shrink-0 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}

            <div className="mt-1 border-t border-zinc-100 pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  setShowModal(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New organization
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewOrgModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
