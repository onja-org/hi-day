"use client";

import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
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
      <DashboardKpiRow organisationId={organisationId} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-primary-dark">
            Recent activity
          </h2>
          <RecentActivityScreenshots organisationId={organisationId} />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-primary-dark">
            Timesheet
          </h2>
          <RecentTimesheetWidget organisationId={organisationId} />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-primary-dark">
            Current project activity
          </h2>
          <CurrentProjectActivity organisationId={organisationId} />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-primary-dark">
            This week
          </h2>
          <ThisWeekPanel organisationId={organisationId} />
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">
          Apps &amp; URLs
        </h2>
        <UrlSessionList organisationId={organisationId} maxEntries={3} />
      </section>
    </div>
  );
}
