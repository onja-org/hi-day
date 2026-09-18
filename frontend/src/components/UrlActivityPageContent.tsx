"use client";

import { useActivityDayFilters } from "@/hooks/useActivityDayFilters";
import { useProjects } from "@/hooks/useProjects";
import { useUrlActivityDay } from "@/hooks/useUrlActivityDay";
import { urlActivityToCsv } from "@/lib/urlActivityToCsv";
import { urlActivityToPdf } from "@/lib/urlActivityToPdf";
import { ActivityFilterToolbar } from "./ActivityFilterToolbar";
import { ActivityQueryStatus } from "./ActivityQueryStatus";
import { ExportButtons } from "./ExportButtons";
import { UrlActivityHourGroup } from "./UrlActivityHourGroup";

type UrlActivityPageContentProps = {
  organisationId: string;
};

/** The Activities page's "URLs" tab — hour-bucketed, day/member/project
 * filterable. `UrlSessionList`/`useUrlSessions` (the unfiltered, most-
 * recent-1000-rows view) stay untouched for their other two callers
 * (the dashboard preview, the member detail page). */
export function UrlActivityPageContent({ organisationId }: UrlActivityPageContentProps) {
  const { date, membershipId, untracked, projectId, canViewOthers } = useActivityDayFilters();

  const dayQuery = useUrlActivityDay(organisationId, {
    date,
    membershipId,
    projectId,
    untracked,
  });
  const projectsQuery = useProjects(organisationId, { status: "all" });
  const day = dayQuery.data;
  const projects = projectsQuery.data ?? [];
  const hasExportableData = !!day && day.buckets.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActivityFilterToolbar organisationId={organisationId} canViewOthers={canViewOthers} />
        <ExportButtons
          csv={day ? urlActivityToCsv(day, projects) : ""}
          buildPdf={
            day
              ? () => urlActivityToPdf(`Website activity — ${date}`, day, projects)
              : () => new Blob()
          }
          filenameBase={`url-activity-${date}`}
          disabled={!hasExportableData}
        />
      </div>

      <ActivityQueryStatus
        isLoading={dayQuery.isLoading}
        isError={dayQuery.isError}
        error={dayQuery.error}
        loadingLabel="Loading website activity…"
        errorFallback="Could not load website activity."
      />

      {day && day.buckets.length === 0 && (
        <p className="text-slate-900">
          {projectId || untracked
            ? "No website activity matches this filter for this day."
            : "No website activity recorded this day."}
        </p>
      )}

      {day?.buckets.map((bucket) => (
        <UrlActivityHourGroup
          key={bucket.hourStart}
          organisationId={organisationId}
          bucket={bucket}
        />
      ))}
    </div>
  );
}
