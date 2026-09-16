"use client";

import { useSearchParams } from "next/navigation";
import { useAppActivityDay } from "@/hooks/useAppActivityDay";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { AppActivityHourGroup } from "./AppActivityHourGroup";
import { ActivityFilterToolbar } from "./ActivityFilterToolbar";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type AppActivityPageContentProps = {
  organisationId: string;
};

export function AppActivityPageContent({
  organisationId,
}: AppActivityPageContentProps) {
  const searchParams = useSearchParams();
  const organisationQuery = useCurrentOrganisation();
  const canViewOthers =
    organisationQuery.data?.role === "admin" || organisationQuery.data?.role === "manager";

  const date = searchParams.get("date") ?? undefined;
  const membershipId = searchParams.get("membershipId") ?? undefined;
  const untracked = searchParams.get("untracked") === "1";
  const projectId = untracked ? undefined : (searchParams.get("projectId") ?? undefined);

  const dayQuery = useAppActivityDay(organisationId, {
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
          Loading app activity…
        </p>
      )}

      {dayQuery.isError && (
        <ErrorMessage
          message={
            dayQuery.error instanceof Error
              ? dayQuery.error.message
              : "Could not load app activity."
          }
        />
      )}

      {dayQuery.data && dayQuery.data.buckets.length === 0 && (
        <p className="text-slate-900">
          {projectId || untracked
            ? "No app activity matches this filter for this day."
            : "No app activity recorded this day — this fills in once window tracking is turned on and a timer is running."}
        </p>
      )}

      {dayQuery.data?.buckets.map((bucket) => (
        <AppActivityHourGroup
          key={bucket.hourStart}
          organisationId={organisationId}
          bucket={bucket}
        />
      ))}
    </div>
  );
}
