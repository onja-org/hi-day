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
export function TimesheetDayGroupSection({ group, onEdit }: TimesheetDayGroupSectionProps) {
  return (
    <tbody>
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
      <tr className="border-b border-input-border">
        <td colSpan={5} className="px-3 py-2">
          <TimesheetDayTimeline dayStart={fromDateKey(group.dateKey)} entries={group.entries} />
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
                className="cursor-pointer text-primary underline underline-offset-2"
              >
                Edit
              </button>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  );
}
