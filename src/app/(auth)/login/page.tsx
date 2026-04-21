"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

type FormState = {
  status: "idle" | "loading" | "error";
  error: string | null;
  showResend: boolean;
};

type ResendState = "idle" | "sending" | "error";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    status: "idle",
    error: null,
    showResend: false,
  });
  const [resendState, setResendState] = useState<ResendState>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormState({ status: "loading", error: null, showResend: false });
    setResendState("idle");

    try {
      const data = await api.login(email, password);
      useAuthStore.getState().setAccessToken(data.accessToken);
      const user = await api.getMe();
      setAuth(data.accessToken, user);
      router.replace("/contracts");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "로그인에 실패했습니다. 다시 시도해주세요.";
      const isUnverified =
        message.toLowerCase().includes("email not verified") ||
        message.toLowerCase().includes("not verified");
      setFormState({
        status: "error",
        error: isUnverified
          ? "이메일 인증이 필요합니다. 받은 편지함을 확인해주세요."
          : message,
        showResend: isUnverified,
      });
    }
  }

  async function handleResend() {
    setResendState("sending");
    try {
      await api.resendVerification(email);
      setResendState("idle");
      toast("success", "인증 메일을 재발송했습니다.");
    } catch {
      setResendState("error");
    }
  }

  const inputBase =
    "w-full rounded-xl border bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-all";
  const inputCls = `${inputBase} border-zinc-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10`;

  return (
    <div className="animate-slide-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">다시 오셨군요</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          계정에 로그인하여 계속하세요
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
          <div className="flex-1 text-sm text-red-700">
            <p>{formState.error}</p>
            {formState.showResend && (
              <div className="mt-2">
                {resendState === "error" ? (
                  <p className="text-xs">재발송에 실패했습니다. 잠시 후 다시 시도해주세요.</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendState === "sending"}
                    className="text-xs font-semibold underline underline-offset-2 hover:text-red-900 disabled:opacity-50"
                  >
                    {resendState === "sending" ? "발송 중…" : "인증 메일 재발송"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
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
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-zinc-700">
              비밀번호
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              비밀번호 찾기
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} pr-11`}
              placeholder="••••••••"
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
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={formState.status === "loading"}
          className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {formState.status === "loading" ? (
            <span className="flex items-center justify-center gap-2.5">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              로그인 중…
            </span>
          ) : (
            "로그인"
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-8 text-center text-sm text-zinc-500">
        계정이 없으신가요?{" "}
        <Link
          href="/signup"
          className="font-semibold text-blue-600 transition-colors hover:text-blue-700"
        >
          무료로 시작하기
        </Link>
      </p>
    </div>
  );
}
