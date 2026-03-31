"use client";

/**
 * Minimal shared UI primitives used across the app.
 * Each export is kept intentionally small — no prop-drilling or complex APIs.
 */

// ── Loading Spinner ────────────────────────────────────────────────────────────

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SPINNER_SIZE: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-8 w-8",
};

export function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 ${SPINNER_SIZE[size]} ${className}`}
    />
  );
}

// ── Modal Overlay ─────────────────────────────────────────────────────────────

interface ModalProps {
  onClose?: () => void;
  children: React.ReactNode;
}

/**
 * Full-screen modal backdrop. Click outside the panel to call onClose.
 * Children should be the panel content (white card).
 */
export function Modal({ onClose, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
