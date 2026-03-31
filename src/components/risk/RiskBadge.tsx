import type { RiskLevel } from "@/types";

interface RiskBadgeProps {
  level: RiskLevel;
  overridden?: boolean;
  className?: string;
}

const STYLES: Record<RiskLevel, string> = {
  HIGH:   "bg-red-50 text-red-700 ring-red-200",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-200",
  LOW:    "bg-green-50 text-green-700 ring-green-200",
  none:   "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

const LABELS: Record<RiskLevel, string> = {
  HIGH:   "High",
  MEDIUM: "Medium",
  LOW:    "Low",
  none:   "—",
};

const DOT_COLORS: Record<RiskLevel, string> = {
  HIGH:   "bg-red-500",
  MEDIUM: "bg-amber-500",
  LOW:    "bg-green-500",
  none:   "bg-zinc-400",
};

export default function RiskBadge({
  level,
  overridden = false,
  className = "",
}: RiskBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
        STYLES[level] ?? STYLES.none
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${DOT_COLORS[level] ?? DOT_COLORS.none}`} />
      {LABELS[level] ?? level}
      {overridden && (
        <span className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-60 bg-current/10">
          edited
        </span>
      )}
    </span>
  );
}
