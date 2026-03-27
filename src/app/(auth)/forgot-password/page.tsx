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
      setError("Something went wrong. Please try again.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 text-center space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mx-auto">
          <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-zinc-900">Check your inbox</h2>
        <p className="text-sm text-zinc-500">
          If an account exists for{" "}
          <span className="font-medium text-zinc-900">{email}</span>, we&apos;ve
          sent a password reset link.
        </p>
        <Link href="/login" className="text-sm font-medium text-zinc-900 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
      <h2 className="mb-2 text-center text-xl font-semibold text-zinc-900">
        Reset your password
      </h2>
      <p className="mb-6 text-center text-sm text-zinc-500">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      {state === "error" && error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
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

        <button
          type="submit"
          disabled={state === "loading"}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "loading" ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-zinc-900 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
