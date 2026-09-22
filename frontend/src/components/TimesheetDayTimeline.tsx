import { buildDayTimelineSegments } from "@/lib/buildDayTimelineSegments";
import type { TimelineSegment } from "@/lib/buildDayTimelineSegments";
import type { TimeEntryListItem } from "@/types/timeEntry";
import {
  PROJECT_COLOUR_TEXT_CLASSES,
  PROJECT_COLOUR_TEXT_MUTED_CLASSES,
} from "./ProjectColourBadge";

type TimesheetDayTimelineProps = {
  dayStart: Date;
  entries: TimeEntryListItem[];
};

const MINUTES_PER_DAY = 24 * 60;
const BAR_HEIGHT = 16;

function formatSegmentTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function segmentTooltip(segment: TimelineSegment): string {
  const timeRange = `${formatSegmentTime(segment.startedAt)} – ${formatSegmentTime(segment.endedAt)}`;
  return segment.kind === "paused"
    ? `${segment.projectName} (paused) • ${timeRange}`
    : `${segment.projectName} • ${timeRange}`;
}

/**
 * A single day's tracked-time occupancy bar: solid blocks for worked time
 * (colored by project), lighter blocks for a paused span within an entry,
 * and the wrapper's own background showing through for untracked gaps.
 * Each block carries a native SVG `<title>` so hovering it shows the
 * project and time entry it belongs to.
 */
export function TimesheetDayTimeline({ dayStart, entries }: TimesheetDayTimelineProps) {
  const segments = buildDayTimelineSegments(entries, dayStart);

  if (segments.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-md bg-sidebar">
      <svg
        viewBox={`0 0 ${MINUTES_PER_DAY} ${BAR_HEIGHT}`}
        width="100%"
        height={BAR_HEIGHT}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="block"
      >
        {segments.map((segment, index) => (
          <rect
            key={index}
            x={segment.startMinute}
            y={2}
            width={Math.max(segment.endMinute - segment.startMinute, 4)}
            height={BAR_HEIGHT - 4}
            rx={2}
            fill="currentColor"
            className={
              segment.kind === "work"
                ? PROJECT_COLOUR_TEXT_CLASSES[segment.projectColour]
                : PROJECT_COLOUR_TEXT_MUTED_CLASSES[segment.projectColour]
            }
          >
            <title>{segmentTooltip(segment)}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
