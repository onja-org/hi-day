"use client";

import { AppWindowIcon } from "@phosphor-icons/react";
import { useMyAppEventsSummary } from "@/hooks/useMyAppEventsSummary";
import { formatDuration } from "@/lib/formatDuration";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type AppActivityPageContentProps = {
  organisationId: string;
};

export function AppActivityPageContent({
  organisationId,
}: AppActivityPageContentProps) {
  const summaryQuery = useMyAppEventsSummary(organisationId);

  if (summaryQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading app activity…
      </p>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <ErrorMessage
        message={
          summaryQuery.error instanceof Error
            ? summaryQuery.error.message
            : "Could not load app activity."
        }
      />
    );
  }

  const { items, totalSecondsSpent } = summaryQuery.data;

  if (items.length === 0) {
    return (
      <p className="text-slate-900">
        No app activity recorded today yet — this fills in once window tracking
        is turned on and a timer is running.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-900/70">
        Today&apos;s foreground app usage, from the desktop agent&apos;s window
        tracking.
      </p>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-input-border text-sm text-slate-900/70">
            <th className="py-2 font-medium">App or window</th>
            <th className="py-2 font-medium">Time spent</th>
            <th className="py-2 font-medium">Percent used</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const percentUsed =
              totalSecondsSpent > 0
                ? Math.round((item.secondsSpent / totalSecondsSpent) * 100)
                : 0;

            return (
              <tr key={item.appName} className="border-b border-input-border">
                <td className="flex items-center gap-2 py-3 text-slate-900">
                  <AppWindowIcon
                    size={20}
                    className="text-primary-dark"
                    aria-hidden="true"
                  />
                  {item.appName}
                </td>
                <td className="py-3 text-slate-900">
                  {formatDuration(Math.round(item.secondsSpent / 60))}
                </td>
                <td className="py-3 text-slate-900">{percentUsed}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
