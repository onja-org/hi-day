"use client";

import { useState } from "react";
import { groupTimeEntriesByDay } from "@/lib/groupTimeEntriesByDay";
import type { TimesheetDatePreset } from "@/lib/getTimesheetDateRange";
import { getTimesheetDateRange } from "@/lib/getTimesheetDateRange";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { TimeEntryFormModal } from "./TimeEntryFormModal";
import { TimesheetDayGroupSection } from "./TimesheetDayGroupSection";

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
          <TimesheetDayGroupSection
            key={group.dateKey}
            group={group}
            onEdit={setEditingEntry}
          />
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
