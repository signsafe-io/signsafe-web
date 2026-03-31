"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { MemberInfo } from "@/types";

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const variants: Record<string, string> = {
    admin: "bg-zinc-900 text-white",
    reviewer: "bg-blue-50 text-blue-700",
    member: "bg-zinc-100 text-zinc-700",
  };
  const cls = variants[role] ?? "bg-zinc-100 text-zinc-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {role}
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-spin rounded-full border border-white/40 border-t-white ${className}`} />
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50";

const primaryBtnCls =
  "flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors";

// ── Invite form (inline) ──────────────────────────────────────────────────────

interface InviteFormProps {
  orgId: string;
  onInvited: () => void;
  onCancel: () => void;
}

function InviteForm({ orgId, onInvited, onCancel }: InviteFormProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      await api.inviteMember(orgId, email.trim(), role);
      toast("success", `${email.trim()} added to organization.`);
      onInvited();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Failed to invite member.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3"
    >
      <p className="text-sm font-medium text-zinc-900">Invite a new member</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@example.com"
          required
          className={`${inputCls} flex-1`}
          autoFocus
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        >
          <option value="member">Member</option>
          <option value="reviewer">Reviewer</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <p className="text-xs text-zinc-400">
        The user must already have a SignSafe account.
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={inviting || !email.trim()}
          className={primaryBtnCls}
        >
          {inviting && <Spinner className="h-3.5 w-3.5" />}
          {inviting ? "Inviting…" : "Send invite"}
        </button>
      </div>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizationSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const orgId = user?.organizationId ?? "";
  const isAdmin = user?.role === "admin";

  // ── Org info ──
  const [orgName, setOrgName] = useState("");
  const [orgPlan, setOrgPlan] = useState("");
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgSaving, setOrgSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    api
      .getOrganization(orgId)
      .then((org) => {
        setOrgName(org.name);
        setOrgPlan(org.plan);
      })
      .catch(() => toast("error", "Failed to load organization."))
      .finally(() => setOrgLoading(false));
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveOrg() {
    if (!orgName.trim()) {
      toast("error", "Organization name cannot be empty.");
      return;
    }
    setOrgSaving(true);
    try {
      await api.updateOrganization(orgId, orgName.trim());
      toast("success", "Organization name updated.");
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Failed to update organization.");
    } finally {
      setOrgSaving(false);
    }
  }

  // ── Members ──
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const fetchMembers = () => {
    if (!orgId) return;
    setMembersLoading(true);
    api
      .listMembers(orgId)
      .then((res) => setMembers(res.members))
      .catch(() => toast("error", "Failed to load members."))
      .finally(() => setMembersLoading(false));
  };

  useEffect(() => {
    fetchMembers();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRemove(targetUserId: string) {
    setRemoving(targetUserId);
    try {
      await api.removeMember(orgId, targetUserId);
      setMembers((prev) => prev.filter((m) => m.userId !== targetUserId));
      toast("success", "Member removed.");
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setRemoving(null);
    }
  }

  async function handleRoleChange(
    targetUserId: string,
    newRole: "admin" | "member" | "reviewer"
  ) {
    setUpdatingRole(targetUserId);
    try {
      await api.updateMemberRole(orgId, targetUserId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.userId === targetUserId ? { ...m, role: newRole } : m))
      );
      toast("success", "Role updated.");
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setUpdatingRole(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Organization</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isAdmin
            ? "Manage your organization's settings and members."
            : "View your organization's settings. Contact an admin to make changes."}
        </p>
      </div>

      {/* Read-only notice for non-admins */}
      {!isAdmin && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 flex items-center gap-3">
          <svg
            className="h-4 w-4 flex-shrink-0 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-zinc-500">
            You have read-only access. Only admins can modify organization settings.
          </p>
        </div>
      )}

      {/* Organization info */}
      <Section
        title="Organization Info"
        description="The display name used throughout SignSafe."
      >
        {orgLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Organization name">
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isAdmin}
                className={inputCls}
              />
            </Field>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500">Plan</span>
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700 capitalize">
                {orgPlan || "free"}
              </span>
            </div>
            {isAdmin && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleSaveOrg}
                  disabled={orgSaving}
                  className={primaryBtnCls}
                >
                  {orgSaving && <Spinner className="h-3.5 w-3.5" />}
                  {orgSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Members */}
      <Section
        title="Members"
        description={`${members.length} member${members.length !== 1 ? "s" : ""} in this organization.`}
      >
        <div className="space-y-1">
          {/* Header row */}
          {!membersLoading && members.length > 0 && (
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-0 pb-2 text-xs font-medium text-zinc-400 uppercase tracking-wide">
              <span>Member</span>
              <span className="hidden sm:block">Role</span>
              <span className="hidden sm:block">Joined</span>
              {isAdmin && <span />}
            </div>
          )}

          {membersLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400">No members found.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {members.map((m) => {
                const isSelf = m.userId === user?.id;
                return (
                  <li
                    key={m.userId}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-3"
                  >
                    {/* Identity */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 uppercase">
                        {m.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {m.fullName}
                          {isSelf && (
                            <span className="ml-1.5 text-xs text-zinc-400 font-normal">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-zinc-400">{m.email}</p>
                      </div>
                    </div>

                    {/* Role */}
                    <div className="hidden sm:block">
                      {isAdmin && !isSelf ? (
                        <select
                          value={m.role}
                          onChange={(e) =>
                            handleRoleChange(
                              m.userId,
                              e.target.value as "admin" | "member" | "reviewer"
                            )
                          }
                          disabled={updatingRole === m.userId}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-40 capitalize"
                        >
                          <option value="member">Member</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <RoleBadge role={m.role} />
                      )}
                    </div>

                    {/* Joined */}
                    <span className="hidden sm:block text-xs text-zinc-400 whitespace-nowrap">
                      {formatDate(m.joinedAt)}
                    </span>

                    {/* Remove */}
                    <div className="flex justify-end w-16">
                      {isAdmin && !isSelf ? (
                        <button
                          onClick={() => handleRemove(m.userId)}
                          disabled={removing === m.userId}
                          className="text-xs text-zinc-400 hover:text-red-600 transition-colors disabled:opacity-40 whitespace-nowrap"
                        >
                          {removing === m.userId ? "Removing…" : "Remove"}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Invite */}
          {isAdmin && (
            <>
              {showInvite ? (
                <InviteForm
                  orgId={orgId}
                  onInvited={() => {
                    setShowInvite(false);
                    fetchMembers();
                  }}
                  onCancel={() => setShowInvite(false)}
                />
              ) : (
                <div className="pt-3">
                  <button
                    onClick={() => setShowInvite(true)}
                    className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-colors"
                  >
                    <svg
                      className="h-4 w-4 text-zinc-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Invite member
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </Section>
    </div>
  );
}
