"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useActivityScreenshots } from "@/hooks/useActivityScreenshots";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import type { ScreenshotSummaryItem } from "@/types/screenshot";
import { ActivityFilterToolbar } from "./ActivityFilterToolbar";
import { ActivityMeter } from "./ActivityMeter";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectBadgeOrUntracked } from "./ProjectBadgeOrUntracked";
import { Spinner } from "./Spinner";

type ScreenshotsPageContentProps = {
  organisationId: string;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPeriodLabel(screenshot: ScreenshotSummaryItem): string {
  if (screenshot.periodStart && screenshot.periodEnd) {
    return `${formatTime(screenshot.periodStart)} - ${formatTime(screenshot.periodEnd)}`;
  }
  return formatTime(screenshot.capturedAt);
}

export function ScreenshotsPageContent({
  organisationId,
}: ScreenshotsPageContentProps) {
  const searchParams = useSearchParams();
  const organisationQuery = useCurrentOrganisation();
  const canViewOthers =
    organisationQuery.data?.role === "admin" ||
    organisationQuery.data?.role === "manager";

  const date = searchParams.get("date") ?? undefined;
  const membershipId = searchParams.get("membershipId") ?? undefined;
  const untracked = searchParams.get("untracked") === "1";
  const projectId = untracked
    ? undefined
    : (searchParams.get("projectId") ?? undefined);

  const screenshotsQuery = useActivityScreenshots(organisationId, {
    date,
    membershipId,
    projectId,
    untracked,
  });

  console.log(screenshotsQuery);
  return (
    <div className="flex flex-col gap-4">
      <ActivityFilterToolbar
        organisationId={organisationId}
        canViewOthers={canViewOthers}
      />

      {screenshotsQuery.isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading screenshots…
        </p>
      )}

      {screenshotsQuery.isError && (
        <ErrorMessage
          message={
            screenshotsQuery.error instanceof Error
              ? screenshotsQuery.error.message
              : "Could not load screenshots."
          }
        />
      )}

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
