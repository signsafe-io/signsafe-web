"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

type FormState = {
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
};

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    status: "idle",
    error: null,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!agreed) {
      setFormState({
        status: "error",
        error: "이용약관에 동의해야 합니다.",
      });
      return;
    }

    setFormState({ status: "loading", error: null });

    try {
      await api.signup(email, password, fullName);
      setFormState({ status: "success", error: null });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "회원가입에 실패했습니다. 다시 시도해주세요.";
      setFormState({ status: "error", error: message });
    }
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";

  if (formState.status === "success") {
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
          <h2 className="text-base font-semibold text-zinc-900">받은 편지함을 확인하세요</h2>
          <p className="mt-2 text-sm text-zinc-500">
            <span className="font-medium text-zinc-900">{email}</span>으로
            인증 링크를 발송했습니다. 링크를 클릭하여 계정을 활성화하세요.
          </p>
        </div>
        <button
          onClick={() => router.push("/login")}
          className="text-sm font-semibold text-zinc-900 transition-colors hover:text-zinc-600"
        >
          로그인으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="animate-slide-in rounded-2xl border border-zinc-200 bg-white px-8 py-8 shadow-sm">
      <div className="mb-7 text-center">
        <h2 className="text-lg font-semibold text-zinc-900">계정 만들기</h2>
        <p className="mt-1 text-sm text-zinc-500">무료로 시작하세요</p>
      </div>

      {formState.error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formState.error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="fullName"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            이름
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputCls}
            placeholder="홍길동"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
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

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder="최소 8자 이상"
          />
          {password.length > 0 && password.length < 8 && (
            <p className="mt-1.5 text-xs text-amber-600">
              비밀번호는 최소 8자 이상이어야 합니다.
            </p>
          )}
          {password.length >= 8 && (
            <p className="mt-1.5 text-xs text-green-600">
              비밀번호 길이가 적합합니다.
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-3 pt-1">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-zinc-900"
          />
          <span className="text-sm text-zinc-600">
            <a
              href="/terms"
              className="font-medium text-zinc-900 hover:underline"
            >
              이용약관
            </a>
            {" "}및{" "}
            <a
              href="/privacy"
              className="font-medium text-zinc-900 hover:underline"
            >
              개인정보처리방침
            </a>
            에 동의합니다
          </span>
        </label>

        <button
          type="submit"
          disabled={formState.status === "loading"}
          className="mt-1 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {formState.status === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
              계정 생성 중…
            </span>
          ) : (
            "계정 만들기"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        이미 계정이 있으신가요?{" "}
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
