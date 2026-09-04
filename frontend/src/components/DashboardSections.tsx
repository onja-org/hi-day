"use client";

import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { ErrorMessage } from "./ErrorMessage";
import { RecentTimesheetWidget } from "./RecentTimesheetWidget";
import { Spinner } from "./Spinner";

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
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">Timesheet</h2>
        <RecentTimesheetWidget organisationId={organisationId} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">Activity</h2>
        <p className="text-slate-900">No recent activity.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">Projects</h2>
        <p className="text-slate-900">No projects yet.</p>
      </section>
    </div>
  );
}
