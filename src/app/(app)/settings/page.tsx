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
      toast("error", "이름을 입력해주세요.");
      return;
    }
    setProfileSaving(true);
    try {
      const updated = await api.updateProfile(profileName.trim());
      if (user) {
        setAuth(accessToken ?? "", { ...user, fullName: updated.fullName });
      }
      toast("success", "프로필이 업데이트되었습니다.");
    } catch (err: unknown) {
      toast("error", getErrorMessage(err, "프로필 업데이트에 실패했습니다."));
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
      return "모든 비밀번호 필드를 입력해주세요.";
    if (newPassword.length < 8)
      return "새 비밀번호는 최소 8자 이상이어야 합니다.";
    if (newPassword !== confirmPassword)
      return "새 비밀번호가 일치하지 않습니다.";
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
      toast("success", "비밀번호가 변경되었습니다.");
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "비밀번호 변경에 실패했습니다.");
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
      .catch(() => toast("error", "조직 목록을 불러오지 못했습니다."))
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
        <h1 className="text-xl font-semibold text-zinc-900">계정</h1>
        <p className="mt-1 text-sm text-zinc-500">
          개인 프로필 및 보안 설정을 관리합니다.
        </p>
      </div>

      {/* Profile */}
      <Section
        title="프로필"
        description="SignSafe 전체에 표시되는 이름을 업데이트합니다."
      >
        <div className="space-y-4">
          <Field label="이름">
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className={inputCls}
              autoComplete="name"
            />
          </Field>
          <div className="flex items-center gap-4">
            <Field label="이메일">
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
              {profileSaving ? "저장 중…" : "변경 사항 저장"}
            </button>
          </div>
        </div>
      </Section>

      {/* Password */}
      <Section
        title="비밀번호"
        description="다른 곳에서 사용하지 않는 강력한 비밀번호를 사용하세요."
      >
        <div className="space-y-4">
          <Field label="현재 비밀번호">
            <input
              type="password"
              value={currentPassword}
              onChange={handlePasswordChange(setCurrentPassword)}
              autoComplete="current-password"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="새 비밀번호">
              <input
                type="password"
                value={newPassword}
                onChange={handlePasswordChange(setNewPassword)}
                autoComplete="new-password"
                className={inputCls}
              />
            </Field>
            <Field label="새 비밀번호 확인">
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
              {passwordSaving ? "변경 중…" : "비밀번호 변경"}
            </button>
          </div>
        </div>
      </Section>

      {/* My organizations */}
      <Section
        title="조직"
        description="소속된 조직입니다. '설정'을 클릭하여 조직을 관리하세요."
      >
        {orgsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
          </div>
        ) : orgs.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-400">
            소속된 조직이 없습니다.
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
                    <p className="text-xs text-zinc-400 capitalize">{org.plan} 플랜</p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <RoleBadge role={org.role} />
                  <Link
                    href="/settings/organization"
                    onClick={() => handleGoToOrgSettings(org)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    설정
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
