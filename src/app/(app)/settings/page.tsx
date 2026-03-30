"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import type { MemberInfo } from "@/types";
import { useToast } from "@/components/ui/Toast";

type Tab = "profile" | "organization" | "members";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, setAuth, accessToken } = useAuthStore();
  const orgId = user?.organizationId ?? "";

  const [tab, setTab] = useState<Tab>("profile");

  // ── Profile ──────────────────────────────────────────────────────────────
  const [profileName, setProfileName] = useState(user?.fullName ?? "");
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  async function handleSaveProfile() {
    if (!profileName.trim()) {
      toast("error", "Name cannot be empty.");
      return;
    }
    setProfileSaving(true);
    try {
      const updated = await api.updateProfile(profileName.trim());
      if (user) {
        setAuth(accessToken ?? "", { ...user, fullName: updated.fullName });
      }
      toast("success", "Profile updated.");
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast("error", "All password fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("error", "New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast("error", "New password must be at least 8 characters.");
      return;
    }
    setPasswordSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("success", "Password changed successfully.");
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  // ── Organization ─────────────────────────────────────────────────────────
  const [orgName, setOrgName] = useState("");
  const [orgPlan, setOrgPlan] = useState("");
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgSaving, setOrgSaving] = useState(false);

  useEffect(() => {
    if (tab !== "organization" && tab !== "members") return;
    if (!orgId) return;
    setOrgLoading(true);
    api.getOrganization(orgId)
      .then((org) => {
        setOrgName(org.name);
        setOrgPlan(org.plan);
      })
      .catch(() => toast("error", "Failed to load organization."))
      .finally(() => setOrgLoading(false));
  }, [tab, orgId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Members ───────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchMembers = () => {
    if (!orgId) return;
    setMembersLoading(true);
    api.listMembers(orgId)
      .then((res) => setMembers(res.members))
      .catch(() => toast("error", "Failed to load members."))
      .finally(() => setMembersLoading(false));
  };

  useEffect(() => {
    if (tab !== "members") return;
    fetchMembers();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      toast("error", "Email is required.");
      return;
    }
    setInviting(true);
    try {
      await api.inviteMember(orgId, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      toast("success", `${inviteEmail} added to organization.`);
      fetchMembers();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Failed to invite member.");
    } finally {
      setInviting(false);
    }
  }

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

  // ── Render ────────────────────────────────────────────────────────────────

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
      tab === t
        ? "bg-zinc-900 text-white"
        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
    }`;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 w-fit">
        <button onClick={() => setTab("profile")} className={tabClass("profile")}>
          Profile
        </button>
        <button onClick={() => setTab("organization")} className={tabClass("organization")}>
          Organization
        </button>
        <button onClick={() => setTab("members")} className={tabClass("members")}>
          Members
        </button>
      </div>

      {/* Profile tab */}
      {tab === "profile" && (
        <div className="space-y-6">
          {/* Display name */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">Display name</h2>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700">Full name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {profileSaving && (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white/40 border-t-white" />
                )}
                {profileSaving ? "Saving…" : "Save name"}
              </button>
            </div>
          </section>

          {/* Change password */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">Change password</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleChangePassword}
                disabled={passwordSaving}
                className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {passwordSaving && (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white/40 border-t-white" />
                )}
                {passwordSaving ? "Saving…" : "Change password"}
              </button>
            </div>
          </section>

          {/* Account info (read-only) */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">Account info</h2>
            <div className="text-sm text-zinc-600 space-y-1">
              <p><span className="font-medium text-zinc-800">Email:</span> {user?.email}</p>
              <p><span className="font-medium text-zinc-800">Role:</span> {user?.role}</p>
            </div>
          </section>
        </div>
      )}

      {/* Organization tab */}
      {tab === "organization" && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-zinc-900">Organization</h2>
          {orgLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700">Organization name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div className="text-sm text-zinc-500">
                Plan: <span className="font-medium text-zinc-700 capitalize">{orgPlan || "free"}</span>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveOrg}
                  disabled={orgSaving}
                  className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {orgSaving && (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white/40 border-t-white" />
                  )}
                  {orgSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Members tab */}
      {tab === "members" && (
        <div className="space-y-4">
          {/* Invite form */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">Invite member</h2>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              >
                <option value="member">Member</option>
                <option value="reviewer">Reviewer</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting}
                className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 whitespace-nowrap"
              >
                {inviting && (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white/40 border-t-white" />
                )}
                {inviting ? "Adding…" : "Add"}
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              The user must already have a SignSafe account.
            </p>
          </section>

          {/* Members list */}
          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            {membersLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
              </div>
            ) : members.length === 0 ? (
              <p className="p-6 text-sm text-zinc-400 text-center">No members found.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {members.map((m) => (
                  <li key={m.userId} className="flex items-center justify-between px-6 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{m.fullName}</p>
                      <p className="text-xs text-zinc-400 truncate">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-xs rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-600 capitalize">
                        {m.role}
                      </span>
                      {m.userId !== user?.id && (
                        <button
                          onClick={() => handleRemove(m.userId)}
                          disabled={removing === m.userId}
                          className="text-xs text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-40"
                        >
                          {removing === m.userId ? "Removing…" : "Remove"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
