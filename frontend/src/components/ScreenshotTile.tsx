"use client";

import Image from "next/image";
import { TrashIcon } from "@phosphor-icons/react";
import { formatTimeOfDay } from "@/lib/formatTimeOfDay";
import type { ScreenshotSummaryItem } from "@/types/screenshot";
import { ProjectBadgeOrUntracked } from "./ProjectBadgeOrUntracked";
import { Spinner } from "./Spinner";

type ScreenshotTileProps = {
  organisationId: string;
  screenshot: ScreenshotSummaryItem;
  /** The first few load eagerly; the rest are below the fold. */
  priority: boolean;
  /** Omitted when this viewer may not delete — no button is rendered. */
  onDelete?: (screenshotId: string) => void;
  isDeleting: boolean;
};

export function ScreenshotTile({
  organisationId,
  screenshot,
  priority,
  onDelete,
  isDeleting,
}: ScreenshotTileProps) {
  const capturedAt = new Date(screenshot.capturedAt);

  return (
    <figure className="group flex flex-col gap-1.5 overflow-hidden rounded-md border border-input-border bg-white">
      <div className="relative aspect-video w-full bg-cream">
        {/* unoptimized: each url is a presigned, single-use Wasabi link — not worth proxying through Next's image optimizer. */}
        <Image
          src={screenshot.url}
          alt={`Screenshot captured at ${capturedAt.toLocaleTimeString()}`}
          fill
          unoptimized
          priority={priority}
          className="object-cover"
        />
        {onDelete && (
          // Revealed on hover, as the gallery it mirrors does — but always
          // present for keyboard and touch, which have no hover.
          <button
            type="button"
            aria-label={`Delete the screenshot from ${formatTimeOfDay(capturedAt)}`}
            disabled={isDeleting}
            onClick={() => onDelete(screenshot.id)}
            className="absolute top-2 right-2 flex size-8 cursor-pointer items-center justify-center rounded-brand-sm border-2 border-ink bg-white/90 text-slate-900 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-100"
          >
            {isDeleting ? (
              <Spinner className="text-primary-dark" />
            ) : (
              <TrashIcon size={16} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      <figcaption className="flex flex-col gap-2 px-2 pb-2">
        <span className="text-sm text-slate-900/70">
          {formatTimeOfDay(capturedAt)}
        </span>
        <ProjectBadgeOrUntracked
          organisationId={organisationId}
          projectId={screenshot.projectId}
        />
      </figcaption>
    </figure>
  );
}
