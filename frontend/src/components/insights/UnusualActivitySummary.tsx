import clsx from "clsx";
import { formatHoursMinutes } from "@/lib/formatHoursMinutes";
import type { UnusualActivitySummary as Summary, UnusualSeverity } from "@/types/unusualActivity";
import { SEVERITY_LABELS } from "./SeverityBadge";

type UnusualActivitySummaryProps = {
  summary: Summary;
  selected: UnusualSeverity[];
  onToggle: (severity: UnusualSeverity) => void;
};

const SEVERITIES: UnusualSeverity[] = ["highly_unusual", "unusual", "slightly_unusual"];

/**
 * The counts per severity — each also a filter — and the time affected,
 * beside the same figure for the 60 days before. Both times follow the
 * selected severities.
 */
export function UnusualActivitySummary({ summary, selected, onToggle }: UnusualActivitySummaryProps) {
  return (
    <section className="flex flex-col gap-4 rounded-brand-sm border border-input-border bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row" role="group" aria-label="Filter by severity">
        {SEVERITIES.map((severity) => (
          <button
            key={severity}
            type="button"
            aria-pressed={selected.includes(severity)}
            onClick={() => onToggle(severity)}
            className={clsx(
              "flex grow items-center justify-between gap-3 rounded-brand-sm border-2 px-3 py-2 text-left transition-colors duration-150",
              selected.includes(severity) && "border-ink bg-cream",
              !selected.includes(severity) && "border-input-border bg-white text-secondary hover:bg-cream",
            )}
          >
            <span className="text-sm font-semibold">{SEVERITY_LABELS[severity]}</span>
            <span className="font-data text-xl">{summary.counts[severity]}</span>
          </button>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm text-secondary">Time affected</dt>
          <dd className="font-data text-2xl text-slate-900">{formatHoursMinutes(summary.affectedSeconds)}</dd>
        </div>
        <div>
          <dt className="text-sm text-secondary">Previous 60 days</dt>
          <dd className="font-data text-2xl text-slate-900">
            {formatHoursMinutes(summary.previousAffectedSeconds)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
