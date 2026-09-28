"use client";

import { useState } from "react";
import { groupTimeEntriesByDay } from "@/lib/groupTimeEntriesByDay";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { TimeEntryFormModal } from "./TimeEntryFormModal";
import { TimesheetDayGroupSection } from "./TimesheetDayGroupSection";

type TimesheetTableProps = {
  organisationId: string;
  entries: TimeEntryListItem[];
  /** True when viewing the caller's own timesheet — only changes the empty-state copy. */
  isOwnTimesheet: boolean;
  /** The period named in the empty-state copy ("for <label>"). Defaults to "today". */
  emptyPeriodLabel?: string;
};

export function TimesheetTable({
  organisationId,
  entries,
  isOwnTimesheet,
  emptyPeriodLabel = "today",
}: TimesheetTableProps) {
  const [editingEntry, setEditingEntry] = useState<TimeEntryListItem | null>(null);

  if (entries.length === 0) {
    const period = ` for ${emptyPeriodLabel}`;
    return (
      <p className="text-slate-900">
        {isOwnTimesheet ? `No hours logged${period} yet.` : `No hours logged${period}.`}
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
        {dayGroups.map((group, index) => (
          <TimesheetDayGroupSection
            key={group.dateKey}
            group={group}
            onEdit={setEditingEntry}
            defaultOpen={index === 0}
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
