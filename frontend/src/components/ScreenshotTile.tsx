"use client";

import Image from "next/image";
import clsx from "clsx";
import { CheckIcon, TrashIcon } from "@phosphor-icons/react";
import { formatTimeOfDay } from "@/lib/formatTimeOfDay";
import type { ScreenshotSummaryItem } from "@/types/screenshot";
import { ProjectBadgeOrUntracked } from "./ProjectBadgeOrUntracked";
import { Spinner } from "./Spinner";

type ScreenshotTileProps = {
  organisationId: string;
  screenshot: ScreenshotSummaryItem;
  /** The first few load eagerly; the rest are below the fold. */
  priority: boolean;
  /** Omitted when this viewer may not delete — no tick box, no button. */
  onDelete?: (screenshotId: string) => void;
  isDeleting: boolean;
  isSelected: boolean;
  /** True while anything in the gallery is ticked, so every other tick box
   * stays visible rather than needing a hover to be found. */
  isSelecting: boolean;
  onSelectedChange: (selected: boolean) => void;
};

export function ScreenshotTile({
  organisationId,
  screenshot,
  priority,
  onDelete,
  isDeleting,
  isSelected,
  isSelecting,
  onSelectedChange,
}: ScreenshotTileProps) {
  const capturedAt = new Date(screenshot.capturedAt);
  const timeOfDay = formatTimeOfDay(capturedAt);
  const isRevealed = isSelected || isSelecting;

  return (
    <figure
      className={clsx(
        "group flex flex-col gap-1.5 overflow-hidden rounded-md border bg-white",
        isSelected && "border-primary",
        !isSelected && "border-input-border",
      )}
    >
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
          // present for keyboard and touch, which have no hover. The scrim
          // keeps the controls legible over a light screenshot.
          <>
            <div
              className={clsx(
                "pointer-events-none absolute inset-0 bg-ink/50 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
                isSelected && "opacity-100",
                !isSelected && "opacity-0",
              )}
            />
            <label
              className={clsx(
                "absolute top-2 left-2 cursor-pointer transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
                isRevealed && "opacity-100",
                !isRevealed && "opacity-0",
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(event) => onSelectedChange(event.target.checked)}
                aria-label={`Select the screenshot from ${timeOfDay}`}
                className="peer sr-only"
              />
              <span className="flex size-5 items-center justify-center rounded-full border-2 border-white bg-ink/60 text-transparent transition-colors duration-150 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                <CheckIcon size={12} weight="bold" aria-hidden="true" />
              </span>
            </label>
            <button
              type="button"
              aria-label={`Delete the screenshot from ${timeOfDay}`}
              disabled={isDeleting}
              onClick={() => onDelete(screenshot.id)}
              className="absolute top-2 right-2 flex size-8 cursor-pointer items-center justify-center rounded-brand-sm border-2 border-ink bg-error text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-100"
            >
              {isDeleting ? (
                <Spinner className="text-white" />
              ) : (
                <TrashIcon size={16} aria-hidden="true" />
              )}
            </button>
          </>
        )}
      </div>
      <figcaption className="flex flex-col gap-2 px-2 pb-2">
        <span className="text-sm text-slate-900/70">{timeOfDay}</span>
        <ProjectBadgeOrUntracked
          organisationId={organisationId}
          projectId={screenshot.projectId}
        />
      </figcaption>
    </figure>
  );
}
