"use client";

import Image from "next/image";
import { useActivityDayFilters } from "@/hooks/useActivityDayFilters";
import { useActivityScreenshots } from "@/hooks/useActivityScreenshots";
import { formatTimeOfDay } from "@/lib/formatTimeOfDay";
import type { ScreenshotSummaryItem } from "@/types/screenshot";
import { ActivityFilterToolbar } from "./ActivityFilterToolbar";
import { ActivityMeter } from "./ActivityMeter";
import { ActivityQueryStatus } from "./ActivityQueryStatus";
import { ProjectBadgeOrUntracked } from "./ProjectBadgeOrUntracked";

type ScreenshotsPageContentProps = {
  organisationId: string;
};

function formatPeriodLabel(screenshot: ScreenshotSummaryItem): string {
  if (screenshot.periodStart && screenshot.periodEnd) {
    return `${formatTimeOfDay(new Date(screenshot.periodStart))} - ${formatTimeOfDay(new Date(screenshot.periodEnd))}`;
  }
  return formatTimeOfDay(new Date(screenshot.capturedAt));
}

export function ScreenshotsPageContent({
  organisationId,
}: ScreenshotsPageContentProps) {
  const { date, membershipId, untracked, projectId, canViewOthers } =
    useActivityDayFilters();

  const screenshotsQuery = useActivityScreenshots(organisationId, {
    date,
    membershipId,
    projectId,
    untracked,
  });

  return (
    <div className="flex flex-col gap-4">
      <ActivityFilterToolbar
        organisationId={organisationId}
        canViewOthers={canViewOthers}
      />

      <ActivityQueryStatus
        isLoading={screenshotsQuery.isLoading}
        isError={screenshotsQuery.isError}
        error={screenshotsQuery.error}
        loadingLabel="Loading screenshots…"
        errorFallback="Could not load screenshots."
      />

      {screenshotsQuery.data && screenshotsQuery.data.length === 0 && (
        <p className="text-slate-900">
          {projectId || untracked
            ? "No screenshots match this filter for this day."
            : "No screenshots captured this day yet — this fills in once screenshots are turned on and a timer is running."}
        </p>
      )}

      {screenshotsQuery.data && screenshotsQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {screenshotsQuery.data.map((screenshot, index) => (
            <figure
              key={screenshot.id}
              className="flex flex-col gap-1.5 overflow-hidden rounded-md border border-input-border bg-white"
            >
              <div className="relative aspect-video w-full bg-cream">
                {/* unoptimized: each url is a presigned, single-use Wasabi link — not worth proxying through Next's image optimizer. */}
                <Image
                  src={screenshot.url}
                  alt={`Screenshot captured at ${new Date(screenshot.capturedAt).toLocaleTimeString()}`}
                  fill
                  unoptimized
                  priority={index < 3}
                  className="object-cover"
                />
              </div>
              <figcaption className="flex flex-col gap-2 px-2 pb-2">
                <span className="text-sm text-slate-900/70">
                  {formatPeriodLabel(screenshot)}
                </span>
                <ProjectBadgeOrUntracked
                  organisationId={organisationId}
                  projectId={screenshot.projectId}
                />
                <ActivityMeter activePercentage={screenshot.activePercentage} />
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
