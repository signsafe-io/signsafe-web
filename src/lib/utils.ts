// ─────────────────────────────────────────────
// Shared utility functions
// ─────────────────────────────────────────────

/**
 * Extract a human-readable message from an unknown error value.
 * Avoids repeating `err instanceof Error ? err.message : "..."` everywhere.
 */
export function getErrorMessage(err: unknown, fallback = "An error occurred."): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Format an ISO date string for display.
 * e.g. "Mar 31, 2026"
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a byte count into a human-readable string.
 * e.g. "1.2 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Determine the expiry status of a contract given its expiresAt ISO string.
 *
 * Returns:
 *  - "expired"      — expiresAt is in the past
 *  - "expiring-soon"— expiresAt is within the next `withinDays` days (default 7)
 *  - null           — not expired or not expiring soon (or no date provided)
 */
export function getExpiryStatus(
  expiresAt: string | null | undefined,
  withinDays = 7
): "expired" | "expiring-soon" | null {
  if (!expiresAt) return null;
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  if (isNaN(expiry)) return null;
  if (expiry < now) return "expired";
  const msUntilExpiry = expiry - now;
  const msThreshold = withinDays * 24 * 60 * 60 * 1000;
  if (msUntilExpiry <= msThreshold) return "expiring-soon";
  return null;
}
