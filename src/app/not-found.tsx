import Link from "next/link";

/**
 * Root not-found page.
 * Rendered when notFound() is called anywhere in the app, or when a URL
 * does not match any route. Next.js returns HTTP 404 for non-streamed responses.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
        <span className="text-2xl font-bold text-zinc-400">404</span>
      </div>

      <div className="space-y-1">
        <h1 className="text-base font-semibold text-zinc-900">
          Page not found
        </h1>
        <p className="text-sm text-zinc-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>

      <Link
        href="/contracts"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Go to contracts
      </Link>
    </div>
  );
}
