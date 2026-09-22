"use client";

import clsx from "clsx";
import Link from "next/link";
import { useTeamDashboardSummary } from "@/hooks/useTeamDashboardSummary";
import { formatElapsed } from "@/lib/formatElapsed";
import { fractionClass } from "@/lib/fractionClass";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type TeamAppsAndSitesProps = {
  organisationId: string;
};

export function TeamAppsAndSites({ organisationId }: TeamAppsAndSitesProps) {
  const summaryQuery = useTeamDashboardSummary(organisationId);

  if (summaryQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return <ErrorMessage message="Could not load the team's app and site activity." />;
  }

  const items = summaryQuery.data.appsAndSites;
  const maxSeconds = Math.max(...items.map((item) => item.seconds), 1);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-input-border p-4">
      {items.length === 0 ? (
        <p className="text-slate-900">No app or website activity yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-slate-900">{item.label}</span>
                <span className="tabular-nums text-primary-dark">
                  {formatElapsed(item.seconds * 1000)}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-lg bg-sidebar">
                <div
                  className={clsx(
                    "h-full rounded-lg bg-primary",
                    fractionClass("w", item.seconds / maxSeconds),
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <Link
        href={`/organisations/${organisationId}/activities/apps`}
        className="self-start text-sm text-primary underline-offset-2 hover:underline"
      >
        View activity →
      </Link>
    </div>
  );
}
