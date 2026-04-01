"use client";

import { useState, useEffect } from "react";
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
import { getErrorMessage, formatDate } from "@/lib/utils";
import type { MemberInfo } from "@/types";

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
      toast("success", `${email.trim()} 을(를) 조직에 추가했습니다.`);
      onInvited();
    } catch (err: unknown) {
      toast("error", getErrorMessage(err, "멤버 초대에 실패했습니다."));
    } finally {
      setInviting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3"
    >
      <p className="text-sm font-medium text-zinc-900">새 멤버 초대</p>
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
          <option value="member">멤버</option>
          <option value="reviewer">검토자</option>
          <option value="admin">관리자</option>
        </select>
      </div>
      <p className="text-xs text-zinc-400">
        해당 사용자가 이미 SignSafe 계정을 보유하고 있어야 합니다.
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={inviting || !email.trim()}
          className={primaryBtnCls}
        >
          {inviting && <Spinner className="h-3.5 w-3.5" />}
          {inviting ? "초대 중…" : "초대 발송"}
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
  const isAdmin = user?.organizationRole === "admin";

  // Org info
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
      .catch(() => toast("error", "조직 정보를 불러오지 못했습니다."))
      .finally(() => setOrgLoading(false));
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveOrg() {
    if (!orgName.trim()) {
      toast("error", "조직 이름을 입력해주세요.");
      return;
    }
    setOrgSaving(true);
    try {
      await api.updateOrganization(orgId, orgName.trim());
      toast("success", "조직 이름이 업데이트되었습니다.");
    } catch (err: unknown) {
      toast("error", getErrorMessage(err, "조직 업데이트에 실패했습니다."));
    } finally {
      setOrgSaving(false);
    }
  }

  // Members
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const fetchMembers = () => {
    if (!orgId) return;
    setMembersLoading(true);
    api
      .listMembers(orgId)
      .then((res) => setMembers(res.members))
      .catch(() => toast("error", "멤버 목록을 불러오지 못했습니다."))
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
      toast("success", "멤버가 제거되었습니다.");
    } catch (err: unknown) {
      toast("error", getErrorMessage(err, "멤버 제거에 실패했습니다."));
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
      toast("success", "역할이 업데이트되었습니다.");
    } catch (err: unknown) {
      toast("error", getErrorMessage(err, "역할 업데이트에 실패했습니다."));
    } finally {
      setUpdatingRole(null);
    }
  }

  async function handleResendInvite(targetEmail: string) {
    setResending(targetEmail);
    try {
      await api.inviteMember(orgId, targetEmail);
      toast("success", `${targetEmail}에게 초대를 재발송했습니다.`);
    } catch (err: unknown) {
      toast("error", getErrorMessage(err, "초대 재발송에 실패했습니다."));
    } finally {
      setResending(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">조직</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isAdmin
            ? "조직의 설정과 멤버를 관리합니다."
            : "조직 설정을 확인합니다. 변경이 필요하면 관리자에게 문의하세요."}
        </p>
      </div>

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
            읽기 전용 접근 권한입니다. 관리자만 조직 설정을 변경할 수 있습니다.
          </p>
        </div>
      )}

      {/* Organization info */}
      <Section
        title="조직 정보"
        description="SignSafe 전체에서 표시되는 조직 이름입니다."
      >
        {orgLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="조직 이름">
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isAdmin}
                className={inputCls}
              />
            </Field>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500">플랜</span>
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700 capitalize">
                {orgPlan || "free"}
              </span>
            </div>
            {isAdmin && (
              <div className="flex justify-end pt-1">
                <button onClick={handleSaveOrg} disabled={orgSaving} className={primaryBtnCls}>
                  {orgSaving && <Spinner className="h-3.5 w-3.5" />}
                  {orgSaving ? "저장 중…" : "변경 사항 저장"}
                </button>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Members */}
      <Section
        title="멤버"
        description={`이 조직의 멤버 ${members.length}명`}
      >
        <div className="space-y-1">
          {!membersLoading && members.length > 0 && (
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-0 pb-2 text-xs font-medium text-zinc-400 uppercase tracking-wide">
              <span>멤버</span>
              <span className="hidden sm:block">역할</span>
              <span className="hidden sm:block">가입일</span>
              {isAdmin && <span />}
            </div>
          )}

          {membersLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400">멤버가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {members.map((m) => {
                const isSelf = m.userId === user?.id;
                return (
                  <li
                    key={m.userId}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 uppercase">
                        {m.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {m.fullName}
                          {isSelf && (
                            <span className="ml-1.5 text-xs text-zinc-400 font-normal">(나)</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-zinc-400">
                          {m.email}
                          {!m.emailVerified && (
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                              미인증
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

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
                          <option value="member">멤버</option>
                          <option value="reviewer">검토자</option>
                          <option value="admin">관리자</option>
                        </select>
                      ) : (
                        <RoleBadge role={m.role} />
                      )}
                    </div>

                    <span className="hidden sm:block text-xs text-zinc-400 whitespace-nowrap">
                      {formatDate(m.joinedAt)}
                    </span>

                    <div className="flex flex-col items-end gap-1 w-24">
                      {isAdmin && !isSelf && !m.emailVerified && (
                        <button
                          onClick={() => handleResendInvite(m.email)}
                          disabled={resending === m.email}
                          className="text-xs text-zinc-500 hover:text-indigo-600 transition-colors disabled:opacity-40 whitespace-nowrap"
                          title="초대 이메일 재발송"
                        >
                          {resending === m.email ? "발송 중…" : "초대 재발송"}
                        </button>
                      )}
                      {isAdmin && !isSelf ? (
                        <button
                          onClick={() => handleRemove(m.userId)}
                          disabled={removing === m.userId}
                          className="text-xs text-zinc-400 hover:text-red-600 transition-colors disabled:opacity-40 whitespace-nowrap"
                        >
                          {removing === m.userId ? "제거 중…" : "제거"}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

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
                    멤버 초대
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
