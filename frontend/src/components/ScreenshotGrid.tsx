"use client";

import clsx from "clsx";
import type { ScreenshotSummaryItem } from "@/types/screenshot";
import { ScreenshotTile } from "./ScreenshotTile";

type ScreenshotGridProps = {
  organisationId: string;
  screenshots: ScreenshotSummaryItem[];
  /** The page on screen is the one being replaced by the next. */
  isStale: boolean;
  /** Absent where the viewer may not delete what is shown. */
  onDelete?: (id: string) => void;
  deletingIds: Set<string>;
  selectedIds: string[];
  onSelectedChange: (id: string, selected: boolean) => void;
};

export function ScreenshotGrid({
  organisationId,
  screenshots,
  isStale,
  onDelete,
  deletingIds,
  selectedIds,
  onSelectedChange,
}: ScreenshotGridProps) {
  return (
    <div
      className={clsx(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        isStale && "opacity-60",
      )}
    >
      {screenshots.map((screenshot, index) => (
        <ScreenshotTile
          key={screenshot.id}
          organisationId={organisationId}
          screenshot={screenshot}
          priority={index < 3}
          onDelete={onDelete}
          isDeleting={deletingIds.has(screenshot.id)}
          isSelected={selectedIds.includes(screenshot.id)}
          isSelecting={selectedIds.length > 0}
          onSelectedChange={(selected) =>
            onSelectedChange(screenshot.id, selected)
          }
        />
      ))}
    </div>
  );
}
