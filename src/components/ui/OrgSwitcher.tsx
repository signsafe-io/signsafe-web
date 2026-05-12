"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/primitives";
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
      setErrorMsg(err instanceof Error ? err.message : "조직 생성에 실패했습니다.");
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="w-full max-w-sm animate-slide-in rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
        <h2 className="mb-5 text-base font-semibold text-zinc-900">새 조직</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="org-name" className="text-sm font-medium text-zinc-700">
              조직 이름
            </label>
            <input
              id="org-name"
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              maxLength={100}
              className="rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50"
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
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={status === "loading" || name.trim().length === 0}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {status === "loading" ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
                  생성 중…
                </span>
              ) : (
                "만들기"
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
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
    toast("success", "조직이 생성되었습니다.");
  }

  const currentOrgName = user?.organizationName;
  const currentOrgId = user?.organizationId;

  if (!currentOrgName) return null;

  return (
    <>
      {/* Always visible — icon-only on mobile, icon+name on sm+ */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={handleOpen}
          className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 sm:px-2.5"
          aria-haspopup="listbox"
          aria-expanded={open}
          title={currentOrgName}
        >
          {/* Building icon — always visible */}
          <svg className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          {/* Org name — hidden on mobile, visible on sm+ */}
          <span className="hidden max-w-[120px] truncate sm:inline">{currentOrgName}</span>
          {/* Chevron — hidden on mobile */}
          <svg
            className={`hidden h-3 w-3 text-zinc-400 transition-transform duration-150 sm:block ${open ? "rotate-180" : ""}`}
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
            className="absolute left-0 bottom-full mb-1.5 w-60 animate-slide-in rounded-xl border border-zinc-200 bg-white py-1 shadow-lg z-40"
          >
            {loadStatus === "loading" && (
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500" />
                <span className="text-xs text-zinc-400">로딩 중…</span>
              </div>
            )}
            {loadStatus === "error" && (
              <p className="px-3 py-2.5 text-xs text-red-500">조직 목록을 불러오지 못했습니다.</p>
            )}
            {loadStatus === "idle" && orgs.length === 0 && (
              <p className="px-3 py-2.5 text-xs text-zinc-400">조직을 찾을 수 없습니다.</p>
            )}
            {loadStatus === "idle" &&
              orgs.map((org) => {
                const isActive = org.id === currentOrgId;
                return (
                  <button
                    key={org.id}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(org)}
                    className="cursor-pointer flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs font-semibold text-zinc-600 uppercase">
                        {org.name.charAt(0)}
                      </div>
                      <span className="truncate">{org.name}</span>
                    </div>
                    {isActive && (
                      <svg
                        className="ml-2 h-3.5 w-3.5 flex-shrink-0 text-zinc-900"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}

            <div className="mt-1 border-t border-zinc-100 pt-1">
              <Link
                href="/settings/organization"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                <svg className="h-4 w-4 flex-shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                조직 설정
              </Link>
              <button
                onClick={() => {
                  setOpen(false);
                  setShowModal(true);
                }}
                className="cursor-pointer flex w-full items-center gap-2.5 px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                <svg className="h-4 w-4 flex-shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                새 조직
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewOrgModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </>
  );
}
