"use client";

import Image from "next/image";
import { useMyScreenshots } from "@/hooks/useMyScreenshots";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type ScreenshotsPageContentProps = {
  organisationId: string;
};

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

  if (screenshots.length === 0) {
    return (
      <p className="text-slate-900">
        No screenshots captured today yet — this fills in once screenshots
        are turned on and a timer is running.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-900/70">
        Today&apos;s screenshots, from the desktop agent&apos;s screenshot
        capture.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {screenshots.map((screenshot) => (
          <figure
            key={screenshot.id}
            className="flex flex-col gap-1.5 overflow-hidden rounded-md border border-input-border bg-white"
          >
            <div className="relative aspect-video w-full bg-cream">
              {/* unoptimized: each url is a presigned, time-limited,
                  single-use Wasabi GET link (docs/adr/0012-...) — routing
                  it through Next's image-optimization proxy would just
                  add a pointless extra fetch/cache layer for a URL that's
                  never reused and will have expired well before any
                  cached copy could pay for itself. */}
              <Image
                src={screenshot.url}
                alt={`Screenshot captured at ${new Date(screenshot.capturedAt).toLocaleTimeString()}`}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
            <figcaption className="px-2 pb-2 text-sm text-slate-900/70">
              {new Date(screenshot.capturedAt).toLocaleTimeString()}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
