"use client";

import { useState } from "react";
import { HALF_HOUR_MS, useNow } from "@/hooks/useNow";
import { groupTimeEntriesByDay } from "@/lib/groupTimeEntriesByDay";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { TimeEntryFormModal } from "./TimeEntryFormModal";
import { TimesheetBatchActions } from "./TimesheetBatchActions";
import { TimesheetDayGroupSection } from "./TimesheetDayGroupSection";

type TimesheetTableProps = {
  organisationId: string;
  entries: TimeEntryListItem[];
  /** True when viewing the caller's own timesheet — only changes the empty-state copy. */
  isOwnTimesheet: boolean;
  zone: string;
  /** The period named in the empty-state copy ("for <label>"). Defaults to "today". */
  emptyPeriodLabel?: string;
};

export function TimesheetTable({
  organisationId,
  entries,
  isOwnTimesheet,
  zone,
  emptyPeriodLabel = "today",
}: TimesheetTableProps) {
  const [editingEntry, setEditingEntry] = useState<TimeEntryListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const now = useNow(HALF_HOUR_MS);

  function toggleSelected(entryId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }

  function toggleDay(entryIds: string[], selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of entryIds) {
        if (selected) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }

  if (entries.length === 0) {
    const period = ` for ${emptyPeriodLabel}`;
    return (
      <p className="text-slate-900">
        {isOwnTimesheet ? `No hours logged${period} yet.` : `No hours logged${period}.`}
      </p>
    );
  }

  const dayGroups = groupTimeEntriesByDay(entries, now, zone);

  // Ticked rows can vanish from under the selection (deleted from their own
  // menu, filtered out by a date change), so the batch action only ever sees
  // ids still on screen.
  const visibleSelectedIds = entries
    .filter((entry) => selectedIds.has(entry.id))
    .map((entry) => entry.id);

  return (
    <div className="flex flex-col gap-3">
      {/* Always rendered — see TimesheetBatchActions for why it hides itself
          rather than being unmounted. */}
      <div>
        <TimesheetBatchActions
          organisationId={organisationId}
          selectedIds={visibleSelectedIds}
          onDeleted={() => setSelectedIds(new Set())}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-input-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          {dayGroups.map((group) => (
            <TimesheetDayGroupSection
              key={group.dateKey}
              organisationId={organisationId}
              group={group}
            zone={zone}
              onEdit={setEditingEntry}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelected}
              onToggleDay={toggleDay}
            />
          ))}
        </table>
      </div>

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
