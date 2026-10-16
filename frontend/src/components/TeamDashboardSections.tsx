"use client";

import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { TeamAppsAndSites } from "./TeamAppsAndSites";
import { TeamGlanceCards } from "./TeamGlanceCards";
import { TeamKpiRow } from "./TeamKpiRow";
import { TeamProjectActivity } from "./TeamProjectActivity";
import { TeamRecentActivity } from "./TeamRecentActivity";
import { WhosOnlineList } from "./WhosOnlineList";

export function TeamDashboardSections() {
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
            : "Could not load the team dashboard."
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

      <TeamKpiRow organisationId={organisationId} />

      <TeamGlanceCards organisationId={organisationId} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">
          Who&apos;s online
        </h2>
        <WhosOnlineList organisationId={organisationId} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {organisationQuery.data.projectsEnabled && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-primary-dark">
              Current project activity
            </h2>
            <TeamProjectActivity organisationId={organisationId} />
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-primary-dark">
            Apps &amp; URLs
          </h2>
          <TeamAppsAndSites organisationId={organisationId} />
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primary-dark">
          Recent activity
        </h2>
        <TeamRecentActivity organisationId={organisationId} />
      </section>
    </div>
  );
}
