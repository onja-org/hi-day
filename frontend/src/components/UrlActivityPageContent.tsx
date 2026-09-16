"use client";

import { useSearchParams } from "next/navigation";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useUrlActivityDay } from "@/hooks/useUrlActivityDay";
import { ActivityFilterToolbar } from "./ActivityFilterToolbar";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";
import { UrlActivityHourGroup } from "./UrlActivityHourGroup";

type UrlActivityPageContentProps = {
  organisationId: string;
};

/** The Activities page's "URLs" tab — hour-bucketed, day/member/project
 * filterable. `UrlSessionList`/`useUrlSessions` (the unfiltered, most-
 * recent-1000-rows view) stay untouched for their other two callers
 * (the dashboard preview, the member detail page). */
export function UrlActivityPageContent({ organisationId }: UrlActivityPageContentProps) {
  const searchParams = useSearchParams();
  const organisationQuery = useCurrentOrganisation();
  const canViewOthers =
    organisationQuery.data?.role === "admin" || organisationQuery.data?.role === "manager";

  const date = searchParams.get("date") ?? undefined;
  const membershipId = searchParams.get("membershipId") ?? undefined;
  const untracked = searchParams.get("untracked") === "1";
  const projectId = untracked ? undefined : (searchParams.get("projectId") ?? undefined);

  const dayQuery = useUrlActivityDay(organisationId, {
    date,
    membershipId,
    projectId,
    untracked,
  });

  return (
    <div className="flex flex-col gap-4">
      <ActivityFilterToolbar organisationId={organisationId} canViewOthers={canViewOthers} />

      {dayQuery.isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading website activity…
        </p>
      )}

      {dayQuery.isError && (
        <ErrorMessage
          message={
            dayQuery.error instanceof Error
              ? dayQuery.error.message
              : "Could not load website activity."
          }
        />
      )}

      {dayQuery.data && dayQuery.data.buckets.length === 0 && (
        <p className="text-slate-900">
          {projectId || untracked
            ? "No website activity matches this filter for this day."
            : "No website activity recorded this day."}
        </p>
      )}

      {dayQuery.data?.buckets.map((bucket) => (
        <UrlActivityHourGroup
          key={bucket.hourStart}
          organisationId={organisationId}
          bucket={bucket}
        />
      ))}
    </div>
  );
}
