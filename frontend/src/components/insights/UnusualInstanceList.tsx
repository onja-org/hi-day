import Link from "next/link";
import { buildUnusualInstanceLinks } from "@/lib/buildUnusualInstanceLinks";
import { formatTimeInZone } from "@/lib/timezone";
import type { UnusualInstance } from "@/types/unusualActivity";
import { SeverityBadge } from "./SeverityBadge";

type UnusualInstanceListProps = {
  organisationId: string;
  /** Omitted when looking at your own. */
  membershipId?: string;
  instances: UnusualInstance[];
  timezone: string;
};

function formatDay(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Each instance: when, how unusual, why, and where to check it. */
export function UnusualInstanceList({ organisationId, membershipId, instances, timezone }: UnusualInstanceListProps) {
  const now = new Date();

  return (
    <ul className="divide-y divide-input-border rounded-brand-sm border border-input-border bg-white">
      {instances.map((instance) => {
        const links = buildUnusualInstanceLinks({
          organisationId,
          membershipId,
          start: instance.start,
          end: instance.end,
          date: instance.date,
          now,
        });
        const [reason, ...moreReasons] = instance.reasons;
        return (
          <li key={`${instance.start}-${instance.rules.join()}`} className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-slate-900">{formatDay(instance.date)}</span>
              <span className="font-data text-sm text-secondary">
                {formatTimeInZone(instance.start, timezone)} – {formatTimeInZone(instance.end, timezone)}
              </span>
              <SeverityBadge severity={instance.severity} />
            </div>
            <p className="text-slate-900">{reason}</p>
            {moreReasons.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-secondary">
                {moreReasons.map((more) => (
                  <li key={more}>{more}</li>
                ))}
              </ul>
            )}
            <p className="flex gap-4 text-sm">
              <Link href={links.screenshots} className="text-primary underline-offset-2 hover:underline">
                View screenshots
              </Link>
              <Link href={links.timesheet} className="text-primary underline-offset-2 hover:underline">
                View timesheet
              </Link>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
