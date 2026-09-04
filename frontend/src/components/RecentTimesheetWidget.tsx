"use client";

import Link from "next/link";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { formatElapsed } from "@/lib/formatElapsed";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { Spinner } from "./Spinner";

const PREVIEW_COUNT = 5;

type RecentTimesheetWidgetProps = {
  organisationId: string;
};

export function RecentTimesheetWidget({ organisationId }: RecentTimesheetWidgetProps) {
  const entriesQuery = useTimeEntries(organisationId);

  if (entriesQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (entriesQuery.isError || !entriesQuery.data) {
    return <ErrorMessage message="Could not load your timesheet." />;
  }

  const entries = entriesQuery.data.slice(0, PREVIEW_COUNT);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-input-border p-4">
      {entries.length === 0 ? (
        <p className="text-slate-900">You haven&apos;t logged any hours yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-900/70">
              <th className="pb-2 font-medium">Project</th>
              <th className="pb-2 font-medium">Time</th>
              <th className="pb-2 text-right font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-input-border">
                <td className="py-2 text-slate-900">
                  <span className="flex items-center gap-2">
                    <ProjectColourBadge colour={entry.projectColour} />
                    {entry.projectName}
                  </span>
                </td>
                <td className="py-2 whitespace-nowrap text-slate-900">
                  {new Date(entry.startedAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-900">
                  {entry.durationSeconds === null
                    ? "In progress"
                    : formatElapsed(entry.durationSeconds * 1000)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Link
        href={`/organisations/${organisationId}/time_entries`}
        className="self-start text-sm text-primary underline-offset-2 hover:underline"
      >
        View timesheets →
      </Link>
    </div>
  );
}
