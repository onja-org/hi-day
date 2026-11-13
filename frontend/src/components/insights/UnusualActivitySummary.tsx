import clsx from "clsx";
import { formatHoursMinutes } from "@/lib/formatHoursMinutes";
import type { UnusualActivitySummary as Summary, UnusualSeverity } from "@/types/unusualActivity";
import { SeverityBadge } from "./SeverityBadge";
import { SeverityFilterChips } from "./SeverityFilterChips";

type UnusualActivitySummaryProps = {
  summary: Summary;
  selected: UnusualSeverity[];
  onToggle: (severity: UnusualSeverity) => void;
};

const SEVERITIES: UnusualSeverity[] = ["highly_unusual", "unusual", "slightly_unusual"];

/**
 * The severity filter, then the instances per severity, then the time
 * affected beside the same figure for the 60 days before. Counts always
 * cover every severity (a hidden one fades); both times follow the
 * selected ones.
 */
export function UnusualActivitySummary({ summary, selected, onToggle }: UnusualActivitySummaryProps) {
  return (
    <section className="flex flex-col gap-3">
      <SeverityFilterChips selected={selected} onToggle={onToggle} />
      {/* One row of five on desktop; three counts over the two times on a phone. */}
      <dl className="grid grid-cols-6 gap-3 md:grid-cols-5">
        {SEVERITIES.map((severity) => (
          <div
            key={severity}
            className={clsx(
              "col-span-2 flex flex-col-reverse justify-end gap-2 rounded-brand-sm border border-input-border bg-white p-3 transition-opacity duration-150 md:col-span-1",
              // Hidden by the filter: still counted, just not in the list or times.
              !selected.includes(severity) && "opacity-50",
            )}
          >
            {/* The badge names the figure, so it's the term; it shows under the number. */}
            <dt>
              <SeverityBadge severity={severity} />
            </dt>
            <dd className="flex items-baseline gap-1">
              <span className="font-data text-2xl text-slate-900">{summary.counts[severity]}</span>
              <span className="text-sm text-secondary">{summary.counts[severity] === 1 ? "instance" : "instances"}</span>
            </dd>
          </div>
        ))}
        <div className="col-span-3 flex flex-col-reverse justify-end gap-1 rounded-brand-sm border border-input-border bg-white p-3 md:col-span-1">
          <dt className="text-sm text-secondary">Time affected (h:m)</dt>
          <dd className="font-data text-2xl text-slate-900">{formatHoursMinutes(summary.affectedSeconds)}</dd>
        </div>
        <div className="col-span-3 flex flex-col-reverse justify-end gap-1 rounded-brand-sm border border-input-border bg-white p-3 md:col-span-1">
          <dt className="text-sm text-secondary">Previous 60 days (h:m)</dt>
          <dd className="font-data text-2xl text-slate-900">{formatHoursMinutes(summary.previousAffectedSeconds)}</dd>
        </div>
      </dl>
    </section>
  );
}
