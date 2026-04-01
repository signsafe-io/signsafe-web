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

  const inputCls =
    "w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";

  return (
    <div className="animate-slide-in rounded-2xl border border-zinc-200 bg-white px-8 py-8 shadow-sm">
      <div className="mb-7 text-center">
        <h2 className="text-lg font-semibold text-zinc-900">Welcome back</h2>
        <p className="mt-1 text-sm text-zinc-500">Sign in to your account</p>
      </div>

      {formState.error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{formState.error}</p>
          {formState.showResend && (
            <div className="mt-2.5">
              {resendState === "error" ? (
                <p>재발송에 실패했습니다. 잠시 후 다시 시도해주세요.</p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendState === "sending"}
                  className="text-xs font-semibold text-red-800 underline underline-offset-2 hover:text-red-900 disabled:opacity-50"
                >
                  {resendState === "sending"
                    ? "발송 중…"
                    : "인증 메일 재발송"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Email
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
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-zinc-700"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-zinc-400 transition-colors hover:text-zinc-700"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={formState.status === "loading"}
          className="mt-1 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {formState.status === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
              Signing in…
            </span>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        No account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-zinc-900 transition-colors hover:text-zinc-600"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
