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
        error: "You must agree to the terms of service.",
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
          : "Signup failed. Please try again.";
      setFormState({ status: "error", error: message });
    }
  }

  if (formState.status === "success") {
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
        <h2 className="text-lg font-semibold text-zinc-900">Check your inbox</h2>
        <p className="text-sm text-zinc-500">
          We&apos;ve sent a verification link to{" "}
          <span className="font-medium text-zinc-900">{email}</span>. Click it
          to activate your account.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="mt-2 text-sm font-medium text-zinc-900 hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
      <h2 className="mb-6 text-center text-xl font-semibold text-zinc-900">
        Create your account
      </h2>

      {formState.error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {formState.error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="fullName"
            className="mb-1 block text-sm font-medium text-zinc-700"
          >
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            placeholder="Jane Doe"
          />
        </div>

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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            placeholder="Min. 8 characters"
          />
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
          />
          <span className="text-sm text-zinc-600">
            I agree to the{" "}
            <a href="/terms" className="font-medium text-zinc-900 hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="font-medium text-zinc-900 hover:underline">
              Privacy Policy
            </a>
          </span>
        </label>

        <button
          type="submit"
          disabled={formState.status === "loading"}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {formState.status === "loading" ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-zinc-900 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
