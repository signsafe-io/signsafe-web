"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  RoleBadge,
  Spinner,
  Section,
  Field,
  inputCls,
  primaryBtnCls,
} from "@/components/ui/SettingsUI";
import { getErrorMessage } from "@/lib/utils";
import type { OrganizationSummary } from "@/types";

export default function AccountSettingsPage() {
  const { toast } = useToast();
  const { user, setAuth, accessToken } = useAuthStore();

  // Profile
  const [profileName, setProfileName] = useState(user?.fullName ?? "");
  const [profileSaving, setProfileSaving] = useState(false);

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
      toast("error", getErrorMessage(err, "Failed to update profile."));
    } finally {
      setProfileSaving(false);
    }
  }

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function validatePasswords(): string | null {
    if (!currentPassword || !newPassword || !confirmPassword)
      return "All password fields are required.";
    if (newPassword.length < 8)
      return "New password must be at least 8 characters.";
    if (newPassword !== confirmPassword)
      return "New passwords do not match.";
    return null;
  }

  function handlePasswordChange(
    setter: (v: string) => void
  ): (e: React.ChangeEvent<HTMLInputElement>) => void {
    return (e) => {
      setter(e.target.value);
      setPasswordError(null);
    };
  }

  async function handleChangePassword() {
    const err = validatePasswords();
    if (err) {
      setPasswordError(err);
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
      const msg = getErrorMessage(err, "Failed to change password.");
      setPasswordError(msg);
      toast("error", msg);
    } finally {
      setPasswordSaving(false);
    }
  }

  // My organizations
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const { switchOrganization } = useAuthStore();

  useEffect(() => {
    api
      .listMyOrganizations()
      .then(setOrgs)
      .catch(() => toast("error", "Failed to load organizations."))
      .finally(() => setOrgsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleGoToOrgSettings(org: OrganizationSummary) {
    if (org.id !== user?.organizationId) {
      switchOrganization(org.id, org.name);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Account</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage your personal profile and security settings.
        </p>
      </div>

      {/* Profile */}
      <Section
        title="Profile"
        description="Update the name that appears across SignSafe."
      >
        <div className="space-y-4">
          <Field label="Full name">
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className={inputCls}
              autoComplete="name"
            />
          </Field>
          <div className="flex items-center gap-4">
            <Field label="Email">
              <p className="py-2 text-sm text-zinc-600">{user?.email}</p>
            </Field>
          </div>
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className={primaryBtnCls}
            >
              {profileSaving && <Spinner className="h-3.5 w-3.5" />}
              {profileSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </Section>

      {/* Password */}
      <Section
        title="Password"
        description="Use a strong password you don't use elsewhere."
      >
        <div className="space-y-4">
          <Field label="Current password">
            <input
              type="password"
              value={currentPassword}
              onChange={handlePasswordChange(setCurrentPassword)}
              autoComplete="current-password"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="New password">
              <input
                type="password"
                value={newPassword}
                onChange={handlePasswordChange(setNewPassword)}
                autoComplete="new-password"
                className={inputCls}
              />
            </Field>
            <Field label="Confirm new password">
              <input
                type="password"
                value={confirmPassword}
                onChange={handlePasswordChange(setConfirmPassword)}
                autoComplete="new-password"
                className={inputCls}
              />
            </Field>
          </div>
          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleChangePassword}
              disabled={passwordSaving}
              className={primaryBtnCls}
            >
              {passwordSaving && <Spinner className="h-3.5 w-3.5" />}
              {passwordSaving ? "Updating…" : "Update password"}
            </button>
          </div>
        </div>
      </Section>

      {/* My organizations */}
      <Section
        title="Organizations"
        description="Organizations you belong to. Click 'Settings' to manage an organization."
      >
        {orgsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
          </div>
        ) : orgs.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-400">
            You are not a member of any organization.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {orgs.map((org) => (
              <li
                key={org.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600 uppercase">
                    {org.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">{org.name}</p>
                    <p className="text-xs text-zinc-400 capitalize">{org.plan} plan</p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <RoleBadge role={org.role} />
                  <Link
                    href="/settings/organization"
                    onClick={() => handleGoToOrgSettings(org)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    Settings
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
