import type { RiskLevel } from "@/types";

interface RiskBadgeProps {
  level: RiskLevel;
  overridden?: boolean;
  className?: string;
}

const STYLES: Record<RiskLevel, string> = {
  HIGH: "bg-red-100 text-red-700 ring-red-200",
  MEDIUM: "bg-orange-100 text-orange-700 ring-orange-200",
  LOW: "bg-green-100 text-green-700 ring-green-200",
  none: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

const LABELS: Record<RiskLevel, string> = {
  HIGH: "High Risk",
  MEDIUM: "Medium Risk",
  LOW: "Low Risk",
  none: "Not Analyzed",
};

export default function RiskBadge({
  level,
  overridden = false,
  className = "",
}: RiskBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
        STYLES[level] ?? STYLES.none
      } ${className}`}
    >
      {LABELS[level] ?? level}
      {overridden && (
        <span className="ml-0.5 rounded bg-current/20 px-1 text-[10px] opacity-70">
          overridden
        </span>
      )}
    </span>
  );
}
