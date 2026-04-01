import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center bg-zinc-50">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm">
        <span className="text-lg font-bold text-zinc-400">404</span>
      </div>

      <div className="space-y-1.5">
        <h1 className="text-base font-semibold text-zinc-900">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-sm text-zinc-500">
          찾으시는 페이지가 존재하지 않거나 이동되었습니다.
        </p>
      </div>

      <Link
        href="/contracts"
        className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
      >
        계약서로 이동
      </Link>
    </div>
  );
}
