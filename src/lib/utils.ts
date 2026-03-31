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
