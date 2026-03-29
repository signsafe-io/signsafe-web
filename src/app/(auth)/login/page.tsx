"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";

type FormState = {
  status: "idle" | "loading" | "error";
  error: string | null;
  showResend: boolean;
};

type ResendState = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

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
        err instanceof Error ? err.message : "Login failed. Please try again.";
      const isUnverified =
        message.toLowerCase().includes("email not verified") ||
        message.toLowerCase().includes("not verified");
      setFormState({
        status: "error",
        error: isUnverified
          ? "Your email address has not been verified. Please check your inbox or request a new verification email."
          : message,
        showResend: isUnverified,
      });
    }
  }

  async function handleResend() {
    setResendState("sending");
    try {
      await api.resendVerification(email);
      setResendState("sent");
    } catch {
      setResendState("error");
    }
  }

  return (
    <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
      <h2 className="mb-6 text-center text-xl font-semibold text-zinc-900">
        Sign in to your account
      </h2>

      {formState.error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          <p>{formState.error}</p>
          {formState.showResend && (
            <div className="mt-2">
              {resendState === "sent" ? (
                <p className="text-green-700">
                  Verification email sent. Please check your inbox.
                </p>
              ) : resendState === "error" ? (
                <p className="text-red-700">Failed to send. Please try again later.</p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendState === "sending"}
                  className="mt-1 text-xs font-medium text-red-800 underline hover:text-red-900 disabled:opacity-50"
                >
                  {resendState === "sending"
                    ? "Sending…"
                    : "Resend verification email"}
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
            className="mb-1 block text-sm font-medium text-zinc-700"
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
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-zinc-700"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            placeholder="••••••••"
          />
        </div>

        <div className="flex items-center justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-zinc-500 hover:text-zinc-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={formState.status === "loading"}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {formState.status === "loading" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        No account?{" "}
        <Link
          href="/signup"
          className="font-medium text-zinc-900 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
