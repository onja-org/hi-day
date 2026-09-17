"use client";

import Image from "next/image";
import Link from "next/link";
import { useMyScreenshots } from "@/hooks/useMyScreenshots";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type RecentActivityScreenshotsProps = {
  organisationId: string;
};

const GRID_SIZE = 6;

export function RecentActivityScreenshots({
  organisationId,
}: RecentActivityScreenshotsProps) {
  const screenshotsQuery = useMyScreenshots(organisationId);

  if (screenshotsQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (screenshotsQuery.isError || !screenshotsQuery.data) {
    return <ErrorMessage message="Could not load your recent activity." />;
  }

  const screenshots = screenshotsQuery.data.slice(0, GRID_SIZE);
  const emptyCellCount = GRID_SIZE - screenshots.length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-input-border p-4">
      <div className="grid grid-cols-3 gap-2">
        {screenshots.map((screenshot, index) => (
          <div
            key={screenshot.id}
            className="relative aspect-video overflow-hidden rounded-lg bg-cream"
          >
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
        ))}
        {Array.from({ length: emptyCellCount }, (_, index) => (
          <div
            key={`empty-${index}`}
            className="flex aspect-video items-center justify-center rounded-lg bg-sidebar text-xs text-slate-900/60"
          >
            No screenshot
          </div>
        ))}
      </div>

      <Link
        href={`/organisations/${organisationId}/activities/screenshots`}
        className="self-start text-sm text-primary underline-offset-2 hover:underline"
      >
        View activity →
      </Link>
    </div>
  );
}
