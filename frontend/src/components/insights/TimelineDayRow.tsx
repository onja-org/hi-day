import clsx from "clsx";
import { formatHoursMinutes } from "@/lib/formatHoursMinutes";
import { timelineSegmentMinutes } from "@/lib/timelineSegmentMinutes";
import { addDaysToKey, formatTimeInZone, startOfDayInZone } from "@/lib/timezone";
import type { TimelineDay } from "@/types/insights";

type TimelineDayRowProps = {
  day: TimelineDay;
  zone: string;
  /** False when activity is hidden from this viewer: no activity strip or figure at all. */
  showActivity: boolean;
};

const BAR_HEIGHT = 16;
const ACTIVITY_HEIGHT = 6;

function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One day of the Timeline: a 24-hour bar coloured by tracked, manual and
 * idle time, a thin strip under it shaded by activity, and the day's totals.
 */
export function TimelineDayRow({ day, zone, showActivity }: TimelineDayRowProps) {
  const dayStart = startOfDayInZone(day.date, zone);
  const minutesInDay =
    (startOfDayInZone(addDaysToKey(day.date, 1), zone).getTime() - dayStart.getTime()) / 60000;
  const segments = day.segments.map((segment) => ({
    ...segment,
    ...timelineSegmentMinutes(segment, dayStart, minutesInDay),
  }));
  const height = showActivity ? BAR_HEIGHT + ACTIVITY_HEIGHT + 2 : BAR_HEIGHT;

  return (
    <li className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4">
      <span className="w-28 shrink-0 text-sm font-semibold text-slate-900">
        {formatDayLabel(day.date)}
      </span>
      <div className="grow overflow-hidden rounded-md bg-sidebar">
        <svg
          viewBox={`0 0 ${minutesInDay} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="block"
        >
          {segments.map((segment) => (
            <rect
              key={`bar-${segment.start}-${segment.kind}`}
              x={segment.startMinute}
              y={0}
              width={Math.max(segment.endMinute - segment.startMinute, 2)}
              height={BAR_HEIGHT}
              fill="currentColor"
              className={clsx(
                segment.kind === "tracked" && "text-primary",
                segment.kind === "manual" && "text-mint",
                segment.kind === "idle" && "text-punch",
              )}
            >
              <title>
                {`${segment.kind} • ${formatTimeInZone(segment.start, zone)} – ${formatTimeInZone(segment.end, zone)}`}
              </title>
            </rect>
          ))}
          {showActivity &&
            segments
              .filter((segment) => segment.activePercentage !== null)
              .map((segment) => (
                <rect
                  key={`activity-${segment.start}`}
                  x={segment.startMinute}
                  y={BAR_HEIGHT + 2}
                  width={Math.max(segment.endMinute - segment.startMinute, 2)}
                  height={ACTIVITY_HEIGHT}
                  fill="currentColor"
                  fillOpacity={Math.max(segment.activePercentage ?? 0, 5) / 100}
                  className="text-primary-dark"
                >
                  <title>{`${segment.activePercentage}% activity`}</title>
                </rect>
              ))}
        </svg>
      </div>
      <dl className="flex shrink-0 font-data text-sm text-slate-900">
        <div className="w-16 text-right">
          <dt className="text-xs text-secondary md:sr-only">Tracked</dt>
          <dd>{formatHoursMinutes(day.trackedSeconds)}</dd>
        </div>
        <div className="w-16 text-right">
          <dt className="text-xs text-secondary md:sr-only">Manual</dt>
          <dd>{formatHoursMinutes(day.manualSeconds)}</dd>
        </div>
        <div className="w-16 text-right">
          <dt className="text-xs text-secondary md:sr-only">Idle</dt>
          <dd>{formatHoursMinutes(day.idleSeconds)}</dd>
        </div>
        {showActivity && (
          <div className="w-16 text-right">
            <dt className="text-xs text-secondary md:sr-only">Activity</dt>
            <dd>{day.activePercentage === null ? "–" : `${day.activePercentage}%`}</dd>
          </div>
        )}
      </dl>
    </li>
  );
}
