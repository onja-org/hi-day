import { CheckIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import type { UnusualSeverity } from "@/types/unusualActivity";
import { SEVERITY_LABELS } from "./SeverityBadge";

type SeverityFilterChipsProps = {
  selected: UnusualSeverity[];
  onToggle: (severity: UnusualSeverity) => void;
};

const SEVERITIES: UnusualSeverity[] = ["highly_unusual", "unusual", "slightly_unusual"];

/** Small toggle chips, coloured like the severity badges, that show or hide each severity. */
export function SeverityFilterChips({ selected, onToggle }: SeverityFilterChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p id="severity-filter-hint" className="text-sm text-secondary">
        Show or hide:
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby="severity-filter-hint">
        {SEVERITIES.map((severity) => (
          <button
            key={severity}
            type="button"
            aria-pressed={selected.includes(severity)}
            onClick={() => onToggle(severity)}
            className={clsx(
              "flex cursor-pointer items-center gap-1 rounded-brand-sm border px-2 py-0.5 text-xs font-semibold whitespace-nowrap transition duration-150 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none",
              severity === "highly_unusual" && "bg-error/10 text-error",
              severity === "unusual" && "bg-sun-tint text-slate-900",
              severity === "slightly_unusual" && "bg-sidebar text-secondary",
              selected.includes(severity) && "border-ink hover:border-primary",
              !selected.includes(severity) && "border-transparent opacity-50 hover:opacity-80",
            )}
          >
            <span
              aria-hidden="true"
              className={clsx(
                "flex size-3.5 items-center justify-center rounded-sm border border-ink",
                selected.includes(severity) && "bg-ink text-white",
                !selected.includes(severity) && "bg-white",
              )}
            >
              {selected.includes(severity) && <CheckIcon size={10} weight="bold" />}
            </span>
            {SEVERITY_LABELS[severity]}
          </button>
        ))}
      </div>
    </div>
  );
}
