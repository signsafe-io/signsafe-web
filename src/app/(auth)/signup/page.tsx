"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

type FormState = {
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
};

function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: "", color: "" };
  if (pw.length < 8) return { level: 1, label: "너무 짧음", color: "bg-red-500" };
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const extras = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  if (extras >= 2) return { level: 3, label: "강함", color: "bg-green-500" };
  if (extras >= 1) return { level: 2, label: "보통", color: "bg-amber-500" };
  return { level: 1, label: "약함", color: "bg-red-500" };
}

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    status: "idle",
    error: null,
  });

  const strength = getPasswordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!agreed) {
      setFormState({ status: "error", error: "이용약관에 동의해야 합니다." });
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

  const inputBase =
    "w-full rounded-xl border bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-all";
  const inputCls = `${inputBase} border-zinc-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10`;

  if (formState.status === "success") {
    return (
      <div className="animate-slide-in text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 ring-8 ring-green-50/50">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">이메일을 확인하세요</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          <span className="font-semibold text-zinc-800">{email}</span>으로
          인증 링크를 보냈습니다.
          <br />
          링크를 클릭하여 계정을 활성화하세요.
        </p>
        <div className="mt-8 rounded-xl border border-zinc-100 bg-zinc-50 px-5 py-4 text-left">
          <p className="mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">다음 단계</p>
          <ol className="space-y-1.5 text-sm text-zinc-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">1</span>
              받은 편지함에서 인증 이메일 확인
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">2</span>
              이메일의 인증 링크 클릭
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">3</span>
              SignSafe에 로그인하여 시작
            </li>
          </ol>
        </div>
        <button
          onClick={() => router.push("/login")}
          className="mt-6 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-700 active:scale-[0.99]"
        >
          로그인 페이지로 이동
        </button>
      </div>
    );
  }

  return (
    <div className="animate-slide-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">계정 만들기</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          무료로 시작하고 언제든 업그레이드하세요
        </p>
      </div>

      {/* Error */}
      {formState.error && (
        <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <p className="text-sm text-red-700">{formState.error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Full name */}
        <div className="space-y-1.5">
          <label htmlFor="fullName" className="block text-sm font-medium text-zinc-700">
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

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
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

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
            비밀번호
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} pr-11`}
              placeholder="최소 8자 이상"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-600"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>

          {/* Password strength meter */}
          {password.length > 0 && (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex gap-1">
                {[1, 2, 3].map((seg) => (
                  <div
                    key={seg}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      strength.level >= seg ? strength.color : "bg-zinc-100"
                    }`}
                  />
                ))}
              </div>
              {strength.label && (
                <p className={`text-xs font-medium ${
                  strength.level === 1 ? "text-red-600" :
                  strength.level === 2 ? "text-amber-600" :
                  "text-green-600"
                }`}>
                  비밀번호 강도: {strength.label}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Terms */}
        <label className="flex cursor-pointer items-start gap-3 pt-1">
          <div className="relative mt-0.5 flex-shrink-0">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-zinc-300 accent-zinc-900"
            />
          </div>
          <span className="text-sm leading-relaxed text-zinc-600">
            <a
              href="/terms"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              이용약관
            </a>
            {" "}및{" "}
            <a
              href="/privacy"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              개인정보처리방침
            </a>
            에 동의합니다
          </span>
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={formState.status === "loading"}
          className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {formState.status === "loading" ? (
            <span className="flex items-center justify-center gap-2.5">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              계정 생성 중…
            </span>
          ) : (
            "계정 만들기"
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-8 text-center text-sm text-zinc-500">
        이미 계정이 있으신가요?{" "}
        <Link
          href="/login"
          className="font-semibold text-blue-600 transition-colors hover:text-blue-700"
        >
          로그인
        </Link>
      </p>
    </div>
  );
}
