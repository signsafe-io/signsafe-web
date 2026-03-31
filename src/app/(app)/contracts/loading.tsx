export default function ContractsLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 space-y-8">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-6 w-28 animate-pulse rounded-lg bg-zinc-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-lg bg-zinc-200" />
      </div>

      {/* List skeleton */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={[
              "flex items-center gap-4 px-5 py-4",
              i > 0 ? "border-t border-zinc-100" : "",
            ].join(" ")}
          >
            <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-lg bg-zinc-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
            </div>
            <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
