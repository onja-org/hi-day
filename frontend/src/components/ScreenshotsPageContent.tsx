"use client";

import Image from "next/image";
import { useMyScreenshots } from "@/hooks/useMyScreenshots";
import type { ScreenshotSummaryItem } from "@/types/screenshot";
import { ActivityMeter } from "./ActivityMeter";
import { ErrorMessage } from "./ErrorMessage";
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
  const screenshotsQuery = useMyScreenshots(organisationId);

  if (screenshotsQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading screenshots…
      </p>
    );
  }

  if (screenshotsQuery.isError || !screenshotsQuery.data) {
    return (
      <ErrorMessage
        message={
          screenshotsQuery.error instanceof Error
            ? screenshotsQuery.error.message
            : "Could not load screenshots."
        }
      />
    );
  }

  const screenshots = screenshotsQuery.data;
  console.log(screenshots);

  if (screenshots.length === 0) {
    return (
      <p className="text-slate-900">
        No screenshots captured today yet — this fills in once screenshots are
        turned on and a timer is running.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {screenshots.map((screenshot) => (
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
              className="object-cover"
            />
          </div>
          <figcaption className="flex flex-col gap-2 px-2 pb-2">
            <span className="text-sm text-slate-900/70">
              {formatPeriodLabel(screenshot)}
            </span>
            <ActivityMeter activePercentage={screenshot.activePercentage} />
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
