"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

type PageState = "loading" | "success" | "error" | "missing";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setState("missing");
      return;
    }

    api
      .verifyEmail(token)
      .then(() => {
        setState("success");
        setTimeout(() => router.replace("/login"), 2500);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Verification failed.";
        setErrorMsg(message);
        setState("error");
      });
  }, [searchParams, router]);

  if (state === "loading") {
    return (
      <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
        <p className="mt-4 text-sm text-zinc-500">Verifying your email…</p>
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
        <h2 className="text-lg font-semibold text-zinc-900">Email verified!</h2>
        <p className="text-sm text-zinc-500">
          Redirecting you to sign in…
        </p>
      </div>
    );
  }

  if (state === "missing") {
    return (
      <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 text-center space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">Missing token</h2>
        <p className="text-sm text-zinc-500">
          The verification link is invalid or expired. Check your inbox for the
          latest verification email.
        </p>
        <Link href="/login" className="text-sm font-medium text-zinc-900 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 text-center space-y-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto">
        <svg
          className="h-6 w-6 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-zinc-900">Verification failed</h2>
      {errorMsg && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}
      <Link href="/login" className="text-sm font-medium text-zinc-900 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
