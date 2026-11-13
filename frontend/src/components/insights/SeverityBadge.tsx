import clsx from "clsx";
import type { UnusualSeverity } from "@/types/unusualActivity";

export const SEVERITY_LABELS: Record<UnusualSeverity, string> = {
  highly_unusual: "Highly unusual",
  unusual: "Unusual",
  slightly_unusual: "Slightly unusual",
};

type SeverityBadgeProps = {
  severity: UnusualSeverity;
};

/** How strongly an instance stood out, as a small coloured label. */
export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={clsx(
        "w-fit rounded-brand-sm px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        severity === "highly_unusual" && "bg-error/10 text-error",
        severity === "unusual" && "bg-sun-tint text-slate-900",
        severity === "slightly_unusual" && "bg-sidebar text-secondary",
      )}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
