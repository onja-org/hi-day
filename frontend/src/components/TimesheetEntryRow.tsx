"use client";

import { formatClockTime } from "@/lib/formatClockTime";
import { formatElapsed } from "@/lib/formatElapsed";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { ProjectAvatar } from "./ProjectAvatar";
import { RunningEntryDuration } from "./RunningEntryDuration";
import { RunningEntryTimeRange } from "./RunningEntryTimeRange";
import { TimeEntryActionsMenu } from "./TimeEntryActionsMenu";

type TimesheetEntryRowProps = {
  organisationId: string;
  entry: TimeEntryListItem;
  onEdit: (entry: TimeEntryListItem) => void;
  isSelected: boolean;
  onToggleSelected: (entryId: string) => void;
};

/** One entry's row: project identity, duration, clock times, Actions menu. */
export function TimesheetEntryRow({
  organisationId,
  entry,
  onEdit,
  isSelected,
  onToggleSelected,
}: TimesheetEntryRowProps) {
  return (
    <tr className="border-b border-input-border last:border-b-0">
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelected(entry.id)}
          aria-label={`Select ${entry.projectName} entry starting ${formatClockTime(entry.startedAt)}`}
          className="h-4 w-4 cursor-pointer accent-primary"
        />
      </td>
      <td className="px-3 py-3">
        <span className="flex items-center gap-3">
          <ProjectAvatar name={entry.projectName} colour={entry.projectColour} />
          <span className="flex flex-col">
            <span className="font-medium text-primary-dark">{entry.projectName}</span>
            <span className="text-xs text-slate-900/60">
              {entry.taskName ?? "No task"}
            </span>
          </span>
        </span>
      </td>
      {/* Activity and Idle stand empty: `activity_samples` was dropped from
          this product, and idle time is only ever discarded, never measured
          as a proportion. The columns wait for a data source. */}
      <td className="px-3 py-3 text-slate-900/40">—</td>
      <td className="px-3 py-3 text-slate-900/40">—</td>
      {/* Entries are entirely hand-entered or entirely tracked — no partial
          manual time exists here — so this is 100% or 0%, not a proportion. */}
      <td className="px-3 py-3 tabular-nums text-slate-900">
        {entry.source === "manual" ? "100%" : "0%"}
      </td>
      <td className="px-3 py-3 tabular-nums text-slate-900">
        {entry.durationSeconds === null ? (
          <RunningEntryDuration entry={entry} />
        ) : (
          formatElapsed(entry.durationSeconds * 1000)
        )}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-slate-900">
        {entry.endedAt
          ? `${formatClockTime(entry.startedAt)} – ${formatClockTime(entry.endedAt)}`
          : <RunningEntryTimeRange startedAt={entry.startedAt} />}
      </td>
      <td className="px-3 py-3 text-right">
        <TimeEntryActionsMenu
          organisationId={organisationId}
          entry={entry}
          onEdit={onEdit}
        />
      </td>
    </tr>
  );
}
