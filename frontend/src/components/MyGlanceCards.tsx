"use client";

import { useAppActivityDay } from "@/hooks/useAppActivityDay";
import { useCurrentTimeEntry } from "@/hooks/useCurrentTimeEntry";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { sumAppSeconds } from "@/lib/sumAppSeconds";
import { todayProjectTimes } from "@/lib/todayProjectTimes";
import { BrandStatCard } from "./BrandStatCard";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

/** Rows per card — the busiest few, with the card total still covering everything. */
const ROW_LIMIT = 5;

type MyGlanceCardsProps = {
  organisationId: string;
};

/** The person's own day and week as ink stat cards — the same cards the landing page's #features shows. */
export function MyGlanceCards({ organisationId }: MyGlanceCardsProps) {
  const summaryQuery = useDashboardSummary(organisationId);
  const appsQuery = useAppActivityDay(organisationId);
  const currentQuery = useCurrentTimeEntry(organisationId);
  const projectsEnabled = useProjectsEnabled();

  if (summaryQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return <ErrorMessage message="Could not load your time at a glance." />;
  }

  const summary = summaryQuery.data;
  const apps = appsQuery.data ? sumAppSeconds(appsQuery.data) : [];
  const runningProjectId =
    currentQuery.data?.entry?.projectId ?? currentQuery.data?.elsewhere?.projectId ?? null;
  const today = todayProjectTimes(summary, runningProjectId);
  const daysWithTime = summary.thisWeekByDay.filter((day) => day.seconds > 0);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {projectsEnabled && (
        <BrandStatCard
          title="Today by project"
          totalSeconds={summary.workedTodaySeconds}
          emptyText="Nothing tracked yet today."
          rows={today.slice(0, ROW_LIMIT).map((project) => ({
            key: project.projectId,
            label: project.projectName,
            seconds: project.seconds,
          }))}
        />
      )}
      <BrandStatCard
        title="Today's top apps"
        totalSeconds={apps.reduce((sum, app) => sum + app.seconds, 0)}
        emptyText={
          appsQuery.isError
            ? "Could not load today's apps."
            : "No app activity yet today — it's recorded by the desktop app while a timer runs."
        }
        rows={apps.slice(0, ROW_LIMIT).map((app) => ({
          key: app.appName,
          label: app.appName,
          seconds: app.seconds,
        }))}
      />
      {projectsEnabled && (
        <BrandStatCard
          title="This week by project"
          totalSeconds={summary.workedThisWeekSeconds}
          emptyText="No projects worked on this week yet."
          rows={summary.projectsThisWeek.slice(0, ROW_LIMIT).map((project) => ({
            key: project.projectId,
            label: project.projectName,
            seconds: project.seconds,
          }))}
        />
      )}
      <BrandStatCard
        title="This week"
        totalSeconds={summary.workedThisWeekSeconds}
        emptyText="Nothing tracked this week yet."
        rows={daysWithTime.map((day) => ({
          key: day.date,
          label: new Date(`${day.date}T00:00:00`).toLocaleDateString([], { weekday: "long" }),
          seconds: day.seconds,
        }))}
      />
    </div>
  );
}
