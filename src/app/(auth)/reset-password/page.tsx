"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/primitives";

type FormState = "idle" | "loading" | "success" | "error" | "missing-token";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<FormState>(
    token ? "idle" : "missing-token"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (newPassword.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }

    setState("loading");

    try {
      await api.resetPassword(token!, newPassword);
      setState("success");
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("링크가 유효하지 않거나 만료되었습니다. 새 링크를 요청해주세요.");
      setState("error");
    }
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";

  if (state === "missing-token") {
    return (
      <div className="animate-slide-in rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-sm text-center space-y-4">
        <h2 className="text-base font-semibold text-zinc-900">유효하지 않은 링크</h2>
        <p className="text-sm text-zinc-500">
          비밀번호 재설정 링크에 토큰이 없습니다.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm font-semibold text-zinc-900 transition-colors hover:text-zinc-600"
        >
          새 재설정 링크 요청
        </Link>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="animate-slide-in rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-sm text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">비밀번호 변경 완료</h2>
          <p className="mt-2 text-sm text-zinc-500">
            비밀번호가 재설정되었습니다. 로그인 페이지로 이동합니다…
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm font-semibold text-zinc-900 transition-colors hover:text-zinc-600"
        >
          로그인으로 이동
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-slide-in rounded-2xl border border-zinc-200 bg-white px-8 py-8 shadow-sm">
      <div className="mb-7 text-center">
        <h2 className="text-lg font-semibold text-zinc-900">새 비밀번호 설정</h2>
        <p className="mt-1 text-sm text-zinc-500">새 비밀번호를 입력해주세요.</p>
      </div>

      {state === "error" && error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="new-password"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            새 비밀번호
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputCls}
            placeholder="최소 8자 이상"
          />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            비밀번호 확인
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputCls}
            placeholder="비밀번호 재입력"
          />
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <p className="mt-1.5 text-xs text-red-600">비밀번호가 일치하지 않습니다.</p>
          )}
        </div>

        {error && state !== "error" && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={state === "loading"}
          className="mt-1 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
              변경 중…
            </span>
          ) : (
            "비밀번호 재설정"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        비밀번호가 기억나시나요?{" "}
        <Link
          href="/login"
          className="font-semibold text-zinc-900 transition-colors hover:text-zinc-600"
        >
          로그인
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-sm flex justify-center">
          <LoadingSpinner size="sm" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
