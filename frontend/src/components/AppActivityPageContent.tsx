"use client";

import { useAppActivityDay } from "@/hooks/useAppActivityDay";
import { useActivityDayFilters } from "@/hooks/useActivityDayFilters";
import { useProjects } from "@/hooks/useProjects";
import { appActivityToCsv } from "@/lib/appActivityToCsv";
import { appActivityToPdf } from "@/lib/appActivityToPdf";
import { AppActivityTable } from "@/components/AppActivityTable";
import { ActivityFilterToolbar } from "@/components/ActivityFilterToolbar";
import { ActivityQueryStatus } from "@/components/ActivityQueryStatus";
import { ExportButtons } from "@/components/ExportButtons";

type AppActivityPageContentProps = {
  organisationId: string;
};

export function AppActivityPageContent({
  organisationId,
}: AppActivityPageContentProps) {
  const { date, membershipId, untracked, projectId, canViewOthers } =
    useActivityDayFilters();

  const dayQuery = useAppActivityDay(organisationId, {
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
        <ActivityFilterToolbar
          organisationId={organisationId}
          canViewOthers={canViewOthers}
        />
        <ExportButtons
          csv={day ? appActivityToCsv(day, projects) : ""}
          buildPdf={
            day
              ? () => appActivityToPdf(`App activity — ${date}`, day, projects)
              : () => new Blob()
          }
          filenameBase={`app-activity-${date}`}
          disabled={!hasExportableData}
        />
      </div>

      <ActivityQueryStatus
        isLoading={dayQuery.isLoading}
        isError={dayQuery.isError}
        error={dayQuery.error}
        loadingLabel="Loading app activity…"
        errorFallback="Could not load app activity."
      />

      {day && day.buckets.length === 0 && (
        <p className="text-slate-900">
          {projectId || untracked
            ? "No app activity matches this filter for this day."
            : "No app activity recorded this day — this fills in once window tracking is turned on and a timer is running."}
        </p>
      )}

      {day && day.buckets.length > 0 && (
        <AppActivityTable
          organisationId={organisationId}
          buckets={day.buckets}
        />
      )}
    </div>
  );
}
