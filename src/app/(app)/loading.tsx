/**
 * Top-level loading skeleton for the (app) route group.
 * Shown while any page inside (app) is streaming its initial server render.
 */
export default function AppLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
    </div>
  );
}
