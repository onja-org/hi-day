"use client";

import { useState } from "react";
import { formatElapsed } from "@/lib/formatElapsed";
import { groupTimeEntriesByDay } from "@/lib/groupTimeEntriesByDay";
import type { TimesheetDatePreset } from "@/lib/getTimesheetDateRange";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { Spinner } from "./Spinner";
import { TimeEntryFormModal } from "./TimeEntryFormModal";

type TimesheetTableProps = {
  organisationId: string;
  /** Omit to view the caller's own timesheet. */
  membershipId?: string;
  /** Defaults to "today". */
  datePreset?: TimesheetDatePreset;
};

const DATE_PRESET_EMPTY_LABEL: Record<Exclude<TimesheetDatePreset, "all">, string> = {
  today: "today",
  yesterday: "yesterday",
  this_week: "this week",
  this_month: "this month",
};

function formatTimeRange(entry: TimeEntryListItem): string {
  const start = new Date(entry.startedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!entry.endedAt) {
    return `${start} – now`;
  }
  const end = new Date(entry.endedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${start} – ${end}`;
}

export function TimesheetTable({
  organisationId,
  membershipId,
  datePreset = "today",
}: TimesheetTableProps) {
  const range = getTimesheetDateRange(datePreset);
  const entriesQuery = useTimeEntries(organisationId, {
    membershipId,
    from: range?.from,
    to: range?.to,
  });
  const [editingEntry, setEditingEntry] = useState<TimeEntryListItem | null>(null);

  if (entriesQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading timesheet…
      </p>
    );
  }

  if (entriesQuery.isError || !entriesQuery.data) {
    return (
      <ErrorMessage
        message={
          entriesQuery.error instanceof Error
            ? entriesQuery.error.message
            : "Could not load this timesheet."
        }
      />
    );
  }

  const entries = entriesQuery.data;

  if (entries.length === 0) {
    const period = datePreset === "all" ? "" : ` for ${DATE_PRESET_EMPTY_LABEL[datePreset]}`;
    return (
      <p className="text-slate-900">
        {membershipId ? `No hours logged${period}.` : `No hours logged${period} yet.`}
      </p>
    );
  }

  const dayGroups = groupTimeEntriesByDay(entries);

  return (
    <div className="overflow-x-auto rounded-lg border border-input-border">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-input-border text-slate-900">
            <th className="px-3 py-2 font-medium">Project</th>
            <th className="px-3 py-2 font-medium">Task</th>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium text-right">Duration</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        {dayGroups.map((group) => (
          <tbody key={group.dateKey}>
            <tr className="border-b border-input-border bg-cream/40">
              <th
                colSpan={4}
                scope="colgroup"
                className="px-3 py-1.5 text-left text-xs font-semibold tracking-wide text-primary-dark uppercase"
              >
                {group.label}
              </th>
              <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-primary-dark">
                {formatElapsed(group.totalSeconds * 1000)}
              </td>
            </tr>
            {group.entries.map((entry) => (
              <tr key={entry.id} className="border-b border-input-border last:border-b-0">
                <td className="px-3 py-2 text-slate-900">
                  <span className="flex items-center gap-2">
                    <ProjectColourBadge colour={entry.projectColour} />
                    {entry.projectName}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-900">{entry.taskName ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-900">
                  {formatTimeRange(entry)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  {entry.durationSeconds === null ? (
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                      In progress
                    </span>
                  ) : (
                    formatElapsed(entry.durationSeconds * 1000)
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {entry.canEdit && entry.durationSeconds !== null && (
                    <button
                      type="button"
                      onClick={() => setEditingEntry(entry)}
                      className="cursor-pointer text-primary underline underline-offset-2"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>

      {editingEntry && (
        <TimeEntryFormModal
          organisationId={organisationId}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}
