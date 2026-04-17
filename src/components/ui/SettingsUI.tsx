"use client";

/**
 * Shared UI primitives used by settings pages.
 */

// ── Role badge ────────────────────────────────────────────────────────────────

interface RoleBadgeProps {
  role: string;
}

const ROLE_BADGE_VARIANTS: Record<string, string> = {
  admin: "bg-zinc-900 text-white",
  reviewer: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  member: "bg-zinc-100 text-zinc-600",
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const cls = ROLE_BADGE_VARIANTS[role] ?? "bg-zinc-100 text-zinc-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {role}
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

interface SpinnerProps {
  className?: string;
}

export function Spinner({ className = "" }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border border-white/30 border-t-white ${className}`}
    />
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <div className="overflow-hidden rounded-2xl bg-zinc-100 shadow-sm">
      <div className="px-6 pt-5 pb-4">
        <h2 className="text-base font-bold text-zinc-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
        )}
      </div>
      <div className="px-6 pb-6">{children}</div>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      {children}
    </div>
  );
}

// ── Shared class strings ──────────────────────────────────────────────────────

export const inputCls =
  "w-full rounded-xl border border-transparent bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50 disabled:bg-zinc-50";

export const primaryBtnCls =
  "inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50";
