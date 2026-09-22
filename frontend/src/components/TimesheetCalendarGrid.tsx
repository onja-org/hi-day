"use client";

import { format, getDay, setDefaultOptions, startOfWeek } from "date-fns";
import { useMemo } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type EventProps,
  type Formats,
} from "react-big-calendar";
import {
  buildCalendarEvents,
  type CalendarEvent,
} from "@/lib/buildCalendarEvents";
import { formatTimeOfDay } from "@/lib/formatTimeOfDay";
import type { TimeEntryListItem } from "@/types/timeEntry";
import {
  PROJECT_COLOUR_BG_CLASSES,
  PROJECT_COLOUR_BG_MUTED_CLASSES,
} from "./ProjectColourBadge";

type TimesheetCalendarGridProps = {
  entries: TimeEntryListItem[];
  start: Date;
  now: Date;
};

setDefaultOptions({ weekStartsOn: 1 });

const GRID_START_TIME = new Date(1970, 0, 1, 6, 0, 0);

const localizer = dateFnsLocalizer({
  format,
  getDay,
  startOfWeek,
  locales: {},
});

const formats: Formats = {
  timeGutterFormat: (date) => formatTimeOfDay(date),
  dayFormat: (date) =>
    date.toLocaleDateString([], { weekday: "short", day: "numeric" }),
  eventTimeRangeFormat: () => "",
};

function CalendarEventContent({ event }: EventProps<CalendarEvent>) {
  if (event.kind === "paused") return null;

  const timeLabel = `${formatTimeOfDay(event.start)} - ${formatTimeOfDay(event.end)}`;
  const projectLabel = event.taskName
    ? `${event.taskName} - ${event.projectName}`
    : event.projectName;

  return (
    <div className="flex h-full flex-col gap-y-1 overflow-hidden text-white">
      <span className="text-xs leading-tight font-medium">{timeLabel}</span>
      <span className="capitalize text-xs leading-tight">{projectLabel}</span>
    </div>
  );
}

export function TimesheetCalendarGrid({
  entries,
  start,
  now,
}: TimesheetCalendarGridProps) {
  const events = useMemo(
    () => buildCalendarEvents(entries, now),
    [entries, now],
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-input-border">
      <div className="h-calendar-grid">
        <Calendar
          localizer={localizer}
          events={events}
          date={start}
          getNow={() => now}
          min={GRID_START_TIME}
          view="week"
          views={["week"]}
          toolbar={false}
          formats={formats}
          components={{ event: CalendarEventContent }}
          eventPropGetter={(event: CalendarEvent) => ({
            className:
              event.kind === "work"
                ? PROJECT_COLOUR_BG_CLASSES[event.projectColour]
                : PROJECT_COLOUR_BG_MUTED_CLASSES[event.projectColour],
          })}
        />
      </div>
    </div>
  );
}
