"use client";

import { buildProjectDayMatrix } from "@/lib/buildProjectDayMatrix";
import { formatDuration } from "@/lib/formatDuration";
import { formatElapsed } from "@/lib/formatElapsed";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { ProjectColourBadge } from "./ProjectColourBadge";

type TimesheetWeeklyMatrixProps = {
  entries: TimeEntryListItem[];
  start: Date;
  zone: string;
};

const DAY_LABEL_FORMAT: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric" };

/** Project × day-of-week totals for one week, matching the Weekly tab of
 * Hubstaff's own "View & edit timesheets" — reimagined with only the columns
 * this app can back with real data (no fabricated Idle/Manual columns). */
export function TimesheetWeeklyMatrix({
  entries,
  start,
  zone,
}: TimesheetWeeklyMatrixProps) {
  const matrix = buildProjectDayMatrix(entries, start, zone);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return date;
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-input-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-input-border text-slate-900">
            <th className="px-3 py-2 font-medium">Project</th>
            {days.map((day) => (
              <th key={day.toISOString()} className="px-3 py-2 text-right font-medium">
                {day.toLocaleDateString([], { ...DAY_LABEL_FORMAT, timeZone: zone })}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-4 text-center text-slate-900">
                No hours logged this week.
              </td>
            </tr>
          ) : (
            matrix.rows.map((row) => (
              <tr key={row.projectId} className="border-b border-input-border last:border-b-0">
                <td className="px-3 py-2 text-slate-900">
                  <span className="flex items-center gap-2">
                    <ProjectColourBadge colour={row.projectColour} />
                    {row.projectName}
                  </span>
                </td>
                {row.dailySeconds.map((seconds, index) => (
                  <td key={index} className="px-3 py-2 text-right tabular-nums text-slate-900">
                    {seconds === 0 ? "–" : formatDuration(Math.round(seconds / 60))}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-primary-dark">
                  {formatElapsed(row.totalSeconds * 1000)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {matrix.rows.length > 0 && (
          <tfoot>
            <tr className="bg-cream/40">
              <th scope="row" className="px-3 py-2 text-left font-semibold text-primary-dark">
                All projects
              </th>
              {matrix.dailyTotals.map((seconds, index) => (
                <td
                  key={index}
                  className="px-3 py-2 text-right font-semibold tabular-nums text-primary-dark"
                >
                  {seconds === 0 ? "–" : formatDuration(Math.round(seconds / 60))}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-primary-dark">
                {formatElapsed(matrix.grandTotal * 1000)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
