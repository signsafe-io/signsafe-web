"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type FormState = "idle" | "loading" | "success" | "error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);

    try {
      await api.forgotPassword(email);
      setState("success");
    } catch {
      setError("오류가 발생했습니다. 다시 시도해주세요.");
      setState("error");
    }
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";

  if (state === "success") {
    return (
      <div className="animate-slide-in rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-sm text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">받은 편지함을 확인하세요</h2>
          <p className="mt-2 text-sm text-zinc-500">
            <span className="font-medium text-zinc-900">{email}</span>에 해당하는
            계정이 존재하면 비밀번호 재설정 링크를 발송했습니다.
          </p>
        </div>
        <Link
          href="/login"
          className="text-sm font-semibold text-zinc-900 transition-colors hover:text-zinc-600"
        >
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-slide-in rounded-2xl border border-zinc-200 bg-white px-8 py-8 shadow-sm">
      <div className="mb-7 text-center">
        <h2 className="text-lg font-semibold text-zinc-900">비밀번호 재설정</h2>
        <p className="mt-1 text-sm text-zinc-500">
          이메일을 입력하시면 재설정 링크를 보내드립니다.
        </p>
      </div>

      {state === "error" && error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700">
            이메일
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={state === "loading"}
          className="mt-1 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
              발송 중…
            </span>
          ) : (
            "재설정 링크 보내기"
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
