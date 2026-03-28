/**
 * Loading skeleton for the contracts list page.
 * Shown while the server streams the contracts list.
 */
export default function ContractsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 h-7 w-48 animate-pulse rounded-md bg-zinc-200" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white p-4 shadow-sm"
          >
            <div className="space-y-2">
              <div className="h-4 w-56 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
            </div>
            <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
