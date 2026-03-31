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
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setState("loading");

    try {
      await api.resetPassword(token!, newPassword);
      setState("success");
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("This link is invalid or has expired. Please request a new one.");
      setState("error");
    }
  }

  if (state === "missing-token") {
    return (
      <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 text-center space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">Invalid link</h2>
        <p className="text-sm text-zinc-500">
          This password reset link is missing a token.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-zinc-900 hover:underline"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 text-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mx-auto">
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
        <h2 className="text-lg font-semibold text-zinc-900">
          Password updated
        </h2>
        <p className="text-sm text-zinc-500">
          Your password has been reset. Redirecting to sign in…
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-zinc-900 hover:underline"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
      <h2 className="mb-2 text-center text-xl font-semibold text-zinc-900">
        Set new password
      </h2>
      <p className="mb-6 text-center text-sm text-zinc-500">
        Enter your new password below.
      </p>

      {state === "error" && error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="new-password"
            className="mb-1 block text-sm font-medium text-zinc-700"
          >
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            placeholder="Min. 8 characters"
          />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-1 block text-sm font-medium text-zinc-700"
          >
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            placeholder="Repeat password"
          />
        </div>

        {error && state !== "error" && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={state === "loading"}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "loading" ? "Updating…" : "Reset password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-medium text-zinc-900 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 flex justify-center">
          <LoadingSpinner size="sm" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
