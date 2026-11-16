import { formatDayRange } from "@/lib/formatDayRange";
import { formatTimeInZone } from "@/lib/timezone";
import type { UnusualInstance } from "@/types/unusualActivity";
import { SeverityBadge } from "./SeverityBadge";

type HighlightsTopInstancesProps = {
  instances: UnusualInstance[];
  timezone: string;
};

/** The most serious instances, one line each: when, how unusual, and the main reason. */
export function HighlightsTopInstances({ instances, timezone }: HighlightsTopInstancesProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-input-border pt-4">
      <h3 className="font-semibold text-slate-900">Most serious</h3>
      <ul className="flex flex-col gap-2">
        {instances.map((instance) => (
          <li
            key={`${instance.start}-${instance.rules.join()}`}
            className="flex flex-col gap-1 rounded-brand-sm border border-input-border p-3"
          >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-slate-900">{formatDayRange(instance.date, instance.date)}</span>
              <span className="font-data text-secondary">
                {formatTimeInZone(instance.start, timezone)} – {formatTimeInZone(instance.end, timezone)}
              </span>
              <SeverityBadge severity={instance.severity} />
            </p>
            <p className="text-slate-900">{instance.reasons[0]}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
