"use client";

import { useTimeEntries } from "@/hooks/useTimeEntries";
import { formatElapsed } from "@/lib/formatElapsed";
import { formatTimeOfDay } from "@/lib/formatTimeOfDay";
import { entryProjectColour, entryTitle } from "@/lib/entryProjectDisplay";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { Spinner } from "./Spinner";

const PREVIEW_COUNT = 5;

type RecentTimesheetWidgetProps = {
  organisationId: string;
};

function formatTimeRange(startedAt: string, endedAt: string | null): string {
  const start = formatTimeOfDay(new Date(startedAt));
  if (!endedAt) {
    return `${start} → now`;
  }
  const end = formatTimeOfDay(new Date(endedAt));
  return `${start} → ${end}`;
}

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/** A compact preview of the caller's most recent entries — a scannable
 * list rather than a full multi-column table, which doesn't fit a
 * half-width dashboard card. The full table lives on the Timesheets page. */
export function RecentTimesheetWidget({ organisationId }: RecentTimesheetWidgetProps) {
  const entriesQuery = useTimeEntries(organisationId);

  if (entriesQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (entriesQuery.isError || !entriesQuery.data) {
    return <ErrorMessage message="Could not load your timesheet." />;
  }

  const entries = entriesQuery.data.slice(0, PREVIEW_COUNT);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-input-border p-4">
        <p className="text-slate-900">You haven&apos;t logged any hours yet.</p>
      </div>
    );
  }

  const mostRecentIsToday = isToday(entries[0].startedAt);

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-input-border p-4">
      {mostRecentIsToday && (
        <span className="pb-1 text-xs font-medium tracking-wide text-slate-900/60 uppercase">
          Today ·{" "}
          {new Date(entries[0].startedAt).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })}
        </span>
      )}
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between gap-3 border-t border-input-border py-2 first:border-t-0 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2 text-slate-900">
              <ProjectColourBadge colour={entryProjectColour(entry)} />
              <span className="truncate">{entryTitle(entry)}</span>
              <span className="shrink-0 font-mono tabular-nums text-slate-900/60">
                {formatTimeRange(entry.startedAt, entry.endedAt)}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {entry.durationSeconds === null && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Live
                </span>
              )}
              <span className="font-mono tabular-nums text-slate-900">
                {entry.durationSeconds === null
                  ? formatElapsed(new Date().getTime() - new Date(entry.startedAt).getTime())
                  : formatElapsed(entry.durationSeconds * 1000)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
