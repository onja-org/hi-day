"use client";

import { useState } from "react";
import { CaretDownIcon, CaretRightIcon, PencilSimpleIcon, PlusIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { formatElapsed } from "@/lib/formatElapsed";
import { fromDateKey } from "@/lib/buildDailyTotals";
import type { TimeEntryDayGroup } from "@/lib/groupTimeEntriesByDay";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { TimeEntryPauseSpans } from "./TimeEntryPauseSpans";
import { TimesheetDayTimeline } from "./TimesheetDayTimeline";

type TimesheetDayGroupSectionProps = {
  group: TimeEntryDayGroup;
  onEdit: (entry: TimeEntryListItem) => void;
  /** Only the most recent day starts expanded — older days start collapsed
   * so a long range (this month/all time) opens on something scannable
   * instead of a wall of rows. */
  defaultOpen: boolean;
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

/** One day's heading + occupancy timeline + entry rows, extracted out of
 * `TimesheetTable` to keep that file under the components size guideline. */
export function TimesheetDayGroupSection({
  group,
  onEdit,
  defaultOpen,
}: TimesheetDayGroupSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <tbody>
      <tr className="border-b border-input-border bg-cream/40">
        <th colSpan={4} scope="colgroup" className="px-1 py-1.5 text-left">
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide text-primary-dark uppercase hover:bg-cream"
          >
            {isOpen ? (
              <CaretDownIcon size={12} aria-hidden="true" />
            ) : (
              <CaretRightIcon size={12} aria-hidden="true" />
            )}
            {group.label}
            <span className="font-normal normal-case text-slate-900/60">
              {group.entries.length} session{group.entries.length === 1 ? "" : "s"}
            </span>
          </button>
        </th>
        <td className="px-3 py-1.5 text-right text-xs font-semibold text-primary-dark">
          <span className="font-normal normal-case text-slate-900/60">Day total </span>
          <span className="tabular-nums">{formatElapsed(group.totalSeconds * 1000)}</span>
        </td>
      </tr>

      {isOpen && (
        <>
          <tr className="border-b border-input-border">
            <td colSpan={5} className="px-3 py-2">
              <TimesheetDayTimeline dayStart={fromDateKey(group.dateKey)} entries={group.entries} />
            </td>
          </tr>
          {group.entries.map((entry) => {
            const isNegligible = entry.durationSeconds !== null && entry.durationSeconds < 60;
            return (
              <tr
                key={entry.id}
                className={clsx(
                  "border-b border-input-border last:border-b-0",
                  isNegligible && "text-slate-900/50",
                )}
              >
                <td className="px-3 py-2 text-slate-900">
                  <span className="flex items-center gap-2">
                    <ProjectColourBadge colour={entry.projectColour} />
                    {entry.projectName}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {entry.taskName ? (
                    <span className="inline-block rounded-full bg-sidebar px-2 py-0.5 text-xs text-slate-900">
                      {entry.taskName}
                    </span>
                  ) : entry.canEdit && entry.durationSeconds !== null ? (
                    <button
                      type="button"
                      onClick={() => onEdit(entry)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-input-border px-2 py-0.5 text-xs text-slate-900/60 hover:border-primary hover:text-primary"
                    >
                      <PlusIcon size={10} aria-hidden="true" />
                      Add task
                    </button>
                  ) : (
                    <span className="text-slate-900">—</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-900">
                  {formatTimeRange(entry)}
                  <TimeEntryPauseSpans pauses={entry.pauses} />
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
                      onClick={() => onEdit(entry)}
                      aria-label="Edit entry"
                      className="cursor-pointer rounded-md border border-input-border p-1.5 text-slate-900 hover:bg-cream"
                    >
                      <PencilSimpleIcon size={14} aria-hidden="true" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </>
      )}
    </tbody>
  );
}
