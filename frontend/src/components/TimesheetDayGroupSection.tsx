"use client";

import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { formatElapsed } from "@/lib/formatElapsed";
import { startOfDayInZone } from "@/lib/timezone";
import type { TimeEntryDayGroup } from "@/lib/groupTimeEntriesByDay";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { TimesheetDayTimeline } from "./TimesheetDayTimeline";
import { TimesheetEntryRow } from "./TimesheetEntryRow";

type TimesheetDayGroupSectionProps = {
  organisationId: string;
  group: TimeEntryDayGroup;
  zone: string;
  onEdit: (entry: TimeEntryListItem) => void;
  selectedIds: Set<string>;
  onToggleSelected: (entryId: string) => void;
  /** Ticks or clears this day's entries in one go. */
  onToggleDay: (entryIds: string[], selected: boolean) => void;
};

/** One day's heading, occupancy timeline, column labels and entry rows. Every
 * day is shown in full — nothing here collapses. */
export function TimesheetDayGroupSection({
  organisationId,
  group,
  zone,
  onEdit,
  selectedIds,
  onToggleSelected,
  onToggleDay,
}: TimesheetDayGroupSectionProps) {
  const projectsEnabled = useProjectsEnabled();
  const columnCount = projectsEnabled ? 8 : 7;
  const dayEntryIds = group.entries.map((entry) => entry.id);
  // Ticked as soon as *any* row is, reading as "this day is part of the
  // selection" — so clicking it then clears the day rather than adding more.
  const anySelected = dayEntryIds.some((id) => selectedIds.has(id));

  return (
    <tbody>
      <tr className="border-b border-input-border bg-cream/40">
        <th colSpan={columnCount} scope="colgroup" className="px-3 py-2 text-left">
          <span className="flex items-center gap-2 text-sm font-semibold text-primary-dark">
            {group.label}:
            <span className="tabular-nums">
              {formatElapsed(group.totalSeconds * 1000)}
            </span>
          </span>
        </th>
      </tr>

      <tr className="border-b border-input-border">
        <td colSpan={columnCount} className="px-3 py-2">
          <TimesheetDayTimeline
            dayStart={startOfDayInZone(group.dateKey, zone)}
            entries={group.entries}
            zone={zone}
          />
        </td>
      </tr>

      {/* Labels live inside each day rather than one table-wide thead, so
          that day's occupancy bar can sit above them. */}
      <tr className="border-b border-input-border text-slate-900">
        <th scope="col" className="px-3 py-2 text-left font-medium">
          <input
            type="checkbox"
            checked={anySelected}
            onChange={() => onToggleDay(dayEntryIds, !anySelected)}
            aria-label={`Select every entry on ${group.label}`}
            className="h-4 w-4 cursor-pointer accent-primary"
          />
        </th>
        {projectsEnabled && (
          <th scope="col" className="px-3 py-2 text-left font-medium">
            Project
          </th>
        )}
        <th scope="col" className="px-3 py-2 text-left font-medium">
          Activity
        </th>
        <th scope="col" className="px-3 py-2 text-left font-medium">
          Idle
        </th>
        <th scope="col" className="px-3 py-2 text-left font-medium">
          Manual
        </th>
        <th scope="col" className="px-3 py-2 text-left font-medium">
          Duration
        </th>
        <th scope="col" className="px-3 py-2 text-left font-medium">
          Time
        </th>
        <th scope="col" className="px-3 py-2" />
      </tr>

      {group.entries.map((entry) => (
        <TimesheetEntryRow
          key={entry.id}
          organisationId={organisationId}
          entry={entry}
          zone={zone}
          onEdit={onEdit}
          isSelected={selectedIds.has(entry.id)}
          onToggleSelected={onToggleSelected}
        />
      ))}
    </tbody>
  );
}
