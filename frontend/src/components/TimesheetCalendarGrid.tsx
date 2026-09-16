"use client";

import { buildCalendarBlocks } from "@/lib/buildCalendarBlocks";
import { getWeekRange } from "@/lib/getWeekRange";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { ErrorMessage } from "./ErrorMessage";
import { ExportCsvButton } from "./ExportCsvButton";
import {
  PROJECT_COLOUR_TEXT_CLASSES,
  PROJECT_COLOUR_TEXT_MUTED_CLASSES,
} from "./ProjectColourBadge";
import { Spinner } from "./Spinner";

type TimesheetCalendarGridProps = {
  organisationId: string;
  membershipId?: string;
  weekOffset: number;
};

// 8 equal grid columns (1 hour-label gutter + 7 days) — a deliberate
// simplification so the non-scrolling HTML header row and the scrolling
// SVG's internal column math always agree without arbitrary Tailwind values.
const COLUMNS = 8;
const PX_PER_HOUR = 48;
const HOURS_IN_DAY = 24;
const GRID_HEIGHT = PX_PER_HOUR * HOURS_IN_DAY;
const GRID_WIDTH = 960;
const COLUMN_WIDTH = GRID_WIDTH / COLUMNS;
const DAY_COLUMN_INSET = 4;

function daysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

/** A week's tracked time positioned by exact time-of-day, one column per
 * day — Hubstaff's Calendar tab reimagined with a fixed-pixel-per-hour SVG
 * (so a short block never gets squashed) inside a scrolling viewport, hour
 * labels drawn inside that same SVG so they never drift out of sync with
 * the gridlines they label. */
export function TimesheetCalendarGrid({
  organisationId,
  membershipId,
  weekOffset,
}: TimesheetCalendarGridProps) {
  const now = new Date();
  const { start, end } = getWeekRange(now, weekOffset);
  const entriesQuery = useTimeEntries(organisationId, { membershipId, from: start, to: end });

  if (entriesQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading timesheet…
      </p>
    );
  }

  if (entriesQuery.isError || !entriesQuery.data) {
    return <ErrorMessage message="Could not load this timesheet." />;
  }

  const entries = entriesQuery.data;
  const blocks = buildCalendarBlocks(entries, start, now);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return date;
  });
  const todayIndex = daysBetween(start, now);
  const nowY = (now.getHours() * 60 + now.getMinutes()) * (PX_PER_HOUR / 60);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <ExportCsvButton
          entries={entries}
          filename={`timesheet-calendar-${start.toISOString().slice(0, 10)}.csv`}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-input-border">
        {/* Fixed intrinsic width (the `--width-calendar-grid` theme token,
            960px, matching the SVG's own viewBox) instead of stretching to
            fill the container — non-uniform scaling would distort hour-label
            text and thin gridlines on a narrow viewport. This wrapper scrolls
            horizontally there instead, the same pattern TimesheetTable
            already uses for its own overflow-x-auto table. grid-cols-8
            divides this fixed width into 8 equal columns, matching the SVG's
            own 8-way viewBox division, so the header and the grid's day
            columns always pixel-align. */}
        <div className="w-calendar-grid">
          <div className="grid grid-cols-8 border-b border-input-border">
            <div />
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className="px-2 py-2 text-center text-xs font-medium text-slate-900"
              >
                {day.toLocaleDateString([], { weekday: "short", day: "numeric" })}
              </div>
            ))}
          </div>
          <div className="max-h-96 overflow-y-auto">
            <svg
              width={GRID_WIDTH}
              height={GRID_HEIGHT}
              viewBox={`0 0 ${GRID_WIDTH} ${GRID_HEIGHT}`}
              role="img"
              aria-label="Time-of-day breakdown for the week"
            >
              {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
                <g key={hour}>
                  <line
                    x1={0}
                    x2={GRID_WIDTH}
                    y1={hour * PX_PER_HOUR}
                    y2={hour * PX_PER_HOUR}
                    stroke="currentColor"
                    className="text-input-border"
                  />
                  <text
                    x={COLUMN_WIDTH - 6}
                    y={hour * PX_PER_HOUR + 12}
                    textAnchor="end"
                    fill="currentColor"
                    className="text-xs text-slate-900/60"
                  >
                    {hour === 0
                      ? ""
                      : `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "am" : "pm"}`}
                  </text>
                </g>
              ))}
              {days.map((_, dayIndex) => (
                <line
                  key={dayIndex}
                  x1={COLUMN_WIDTH * (dayIndex + 1)}
                  x2={COLUMN_WIDTH * (dayIndex + 1)}
                  y1={0}
                  y2={GRID_HEIGHT}
                  stroke="currentColor"
                  className="text-input-border"
                />
              ))}
              {blocks.map((block, index) => (
                <rect
                  key={index}
                  x={COLUMN_WIDTH * (block.dayIndex + 1) + DAY_COLUMN_INSET}
                  y={block.startMinute * (PX_PER_HOUR / 60)}
                  width={COLUMN_WIDTH - DAY_COLUMN_INSET * 2}
                  height={Math.max(
                    (block.endMinute - block.startMinute) * (PX_PER_HOUR / 60),
                    3,
                  )}
                  rx={3}
                  fill="currentColor"
                  className={
                    block.kind === "work"
                      ? PROJECT_COLOUR_TEXT_CLASSES[block.projectColour]
                      : PROJECT_COLOUR_TEXT_MUTED_CLASSES[block.projectColour]
                  }
                />
              ))}
              {todayIndex >= 0 && todayIndex <= 6 && (
                <line
                  x1={COLUMN_WIDTH * (todayIndex + 1)}
                  x2={COLUMN_WIDTH * (todayIndex + 2)}
                  y1={nowY}
                  y2={nowY}
                  stroke="currentColor"
                  strokeWidth={2}
                  className="text-error"
                />
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

