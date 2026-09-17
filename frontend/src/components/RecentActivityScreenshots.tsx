"use client";

import Image from "next/image";
import { ImagesSquareIcon } from "@phosphor-icons/react";
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

  if (screenshots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-input-border p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-sidebar text-slate-900/60">
          <ImagesSquareIcon size={24} aria-hidden="true" />
        </span>
        <p className="font-medium text-slate-900">No screenshots captured yet</p>
        <p className="max-w-sm text-sm text-slate-900/60">
          Screenshots of your work appear here while activity capture is on. They stay
          private to you and your workspace admins.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg border border-input-border p-4">
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
    </div>
  );
}
