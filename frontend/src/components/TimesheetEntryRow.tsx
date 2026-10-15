"use client";

import { formatTimeInZone } from "@/lib/timezone";
import { formatElapsed } from "@/lib/formatElapsed";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { entryProjectColour, entryTitle } from "@/lib/entryProjectDisplay";
import { ProjectAvatar } from "./ProjectAvatar";
import { RunningEntryDuration } from "./RunningEntryDuration";
import { RunningEntryTimeRange } from "./RunningEntryTimeRange";
import { TimeEntryActionsMenu } from "./TimeEntryActionsMenu";

type TimesheetEntryRowProps = {
  organisationId: string;
  entry: TimeEntryListItem;
  zone: string;
  onEdit: (entry: TimeEntryListItem) => void;
  isSelected: boolean;
  onToggleSelected: (entryId: string) => void;
};

/** One entry's row: project identity, duration, clock times, Actions menu. */
export function TimesheetEntryRow({
  organisationId,
  entry,
  zone,
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
          aria-label={`Select ${entryTitle(entry)} entry starting ${formatTimeInZone(entry.startedAt, zone)}`}
          className="h-4 w-4 cursor-pointer accent-primary"
        />
      </td>
      <td className="px-3 py-3">
        <span className="flex items-center gap-3">
          {entry.projectId !== null && (
            <ProjectAvatar name={entryTitle(entry)} colour={entryProjectColour(entry)} />
          )}
          <span className="flex flex-col">
            <span className="font-medium text-primary-dark">{entryTitle(entry)}</span>
            {/* An entry with no project has no task either, so a "No task"
                line under it would only be noise. */}
            {(entry.projectId !== null || entry.taskName !== null) && (
              <span className="text-xs text-slate-900/60">
                {entry.taskName ?? "No task"}
              </span>
            )}
          </span>
        </span>
      </td>
      {/* Null is "nothing measured", which a bare 0% would misreport. */}
      <td className="px-3 py-3 tabular-nums text-slate-900">
        {entry.activePercentage === null ? (
          <span className="text-slate-900/40">—</span>
        ) : (
          `${entry.activePercentage}%`
        )}
      </td>
      <td className="px-3 py-3 text-slate-900">
        {entry.type === "idle" || entry.type === "resumed" ? (
          <span className="rounded-full bg-cream px-2 py-0.5 text-xs text-primary-dark capitalize">
            {entry.type}
          </span>
        ) : (
          <span className="text-slate-900/40">—</span>
        )}
      </td>
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
          ? `${formatTimeInZone(entry.startedAt, zone)} – ${formatTimeInZone(entry.endedAt, zone)}`
          : <RunningEntryTimeRange startedAt={entry.startedAt} zone={zone} />}
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
