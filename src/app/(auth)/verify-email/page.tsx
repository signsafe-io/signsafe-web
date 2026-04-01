"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

type PageState = "loading" | "success" | "error" | "missing";

function VerifyEmailContent() {
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
          err instanceof Error ? err.message : "인증에 실패했습니다.";
        setErrorMsg(message);
        setState("error");
      });
  }, [searchParams, router]);

  if (state === "loading") {
    return (
      <div className="animate-fade-in rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-sm text-center space-y-4">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
        <p className="text-sm text-zinc-500">이메일 인증 중…</p>
      </div>
    );
  }

  if (state === "success") {
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
          <h2 className="text-base font-semibold text-zinc-900">이메일 인증 완료!</h2>
          <p className="mt-2 text-sm text-zinc-500">로그인 페이지로 이동합니다…</p>
        </div>
      </div>
    );
  }

  if (state === "missing") {
    return (
      <div className="animate-slide-in rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-sm text-center space-y-4">
        <h2 className="text-base font-semibold text-zinc-900">토큰 없음</h2>
        <p className="text-sm text-zinc-500">
          인증 링크가 유효하지 않거나 만료되었습니다. 받은 편지함에서 최신 인증 이메일을 확인해주세요.
        </p>
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
    <div className="animate-slide-in rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-sm text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
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
      <div>
        <h2 className="text-base font-semibold text-zinc-900">인증 실패</h2>
        {errorMsg && (
          <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
        )}
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

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
