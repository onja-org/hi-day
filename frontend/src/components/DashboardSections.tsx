"use client";

import Link from "next/link";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { formatElapsed } from "@/lib/formatElapsed";
import { CurrentProjectActivity } from "./CurrentProjectActivity";
import { DashboardKpiRow } from "./DashboardKpiRow";
import { ErrorMessage } from "./ErrorMessage";
import { RecentActivityScreenshots } from "./RecentActivityScreenshots";
import { RecentTimesheetWidget } from "./RecentTimesheetWidget";
import { Spinner } from "./Spinner";
import { ThisWeekPanel } from "./ThisWeekPanel";
import { UrlSessionList } from "./UrlSessionList";

export function DashboardSections() {
  const organisationQuery = useCurrentOrganisation();
  const summaryQuery = useDashboardSummary(String(organisationQuery.data?.id ?? ""), {
    enabled: organisationQuery.data !== undefined,
  });

  if (organisationQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (organisationQuery.isError || !organisationQuery.data) {
    return (
      <ErrorMessage
        message={
          organisationQuery.error instanceof Error
            ? organisationQuery.error.message
            : "Could not load your dashboard."
        }
      />
    );
  }

  const organisationId = String(organisationQuery.data.id);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-900/60">
        {new Date().toLocaleDateString([], {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>

      <DashboardKpiRow organisationId={organisationId} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-primary-dark">This week</h2>
            {summaryQuery.data && (
              <span className="text-sm text-slate-900/60">
                Total{" "}
                <span className="font-semibold tabular-nums text-primary-dark">
                  {formatElapsed(summaryQuery.data.workedThisWeekSeconds * 1000)}
                </span>
              </span>
            )}
          </div>
          <ThisWeekPanel organisationId={organisationId} />
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-primary-dark">Recent entries</h2>
            <Link
              href={`/organisations/${organisationId}/time_entries`}
              className="text-sm text-primary underline-offset-2 hover:underline"
            >
              View timesheets →
            </Link>
          </div>
          <RecentTimesheetWidget organisationId={organisationId} />
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-primary-dark">Project Activity</h2>
            <Link
              href={`/organisations/${organisationId}/projects`}
              className="text-sm text-primary underline-offset-2 hover:underline"
            >
              View projects →
            </Link>
          </div>
          <CurrentProjectActivity organisationId={organisationId} />
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-primary-dark">Apps &amp; URLs</h2>
            <Link
              href={`/organisations/${organisationId}/activities/apps`}
              className="text-sm text-primary underline-offset-2 hover:underline"
            >
              View activity →
            </Link>
          </div>
          <UrlSessionList organisationId={organisationId} maxEntries={5} />
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-primary-dark">Screenshots</h2>
          <Link
            href={`/organisations/${organisationId}/activities/screenshots`}
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            View Screenshots Activity →
          </Link>
        </div>
        <RecentActivityScreenshots organisationId={organisationId} />
      </section>
    </div>
  );
}
