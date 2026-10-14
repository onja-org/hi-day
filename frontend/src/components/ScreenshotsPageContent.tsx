"use client";

import { useState } from "react";
import clsx from "clsx";
import { useActivityDayFilters } from "@/hooks/useActivityDayFilters";
import { useActivityScreenshots } from "@/hooks/useActivityScreenshots";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useDeleteScreenshots } from "@/hooks/useDeleteScreenshots";
import { ActivityFilterToolbar } from "./ActivityFilterToolbar";
import { ActivityQueryStatus } from "./ActivityQueryStatus";
import { ConfirmDialog } from "./ConfirmDialog";
import { ScreenshotSelectionBar } from "./ScreenshotSelectionBar";
import { ScreenshotTile } from "./ScreenshotTile";

type ScreenshotsPageContentProps = {
  organisationId: string;
};

export function ScreenshotsPageContent({
  organisationId,
}: ScreenshotsPageContentProps) {
  const { date, membershipId, projectId, canViewOthers } =
    useActivityDayFilters();

  const screenshotsQuery = useActivityScreenshots(organisationId, {
    date,
    membershipId,
    projectId,
  });
  const [tickedIds, setTickedIds] = useState<string[]>([]);
  /** Non-null while the confirmation dialog is open, holding what it would
   * delete — one id from a tile's button, or the whole selection. */
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  // Resolved server-side: an admin always, everyone else only where the
  // organisation (or their own override) allows it.
  const canDelete =
    useCurrentOrganisation().data?.canDeleteOwnScreenshots ?? false;

  const deleteMutation = useDeleteScreenshots(organisationId, () => {
    setPendingIds(null);
    setTickedIds([]);
  });

  const screenshots = screenshotsQuery.data ?? [];
  // Derived rather than reset in an effect: changing the day or filter
  // swaps the gallery, and a tick on a screenshot that is no longer shown
  // would otherwise delete something the user cannot see.
  const visibleIds = new Set(screenshots.map((screenshot) => screenshot.id));
  const selectedIds = tickedIds.filter((id) => visibleIds.has(id));
  const deletingIds = deleteMutation.isPending
    ? new Set(deleteMutation.variables)
    : new Set<string>();

  const pendingCount = pendingIds?.length ?? 0;
  const pendingNoun = pendingCount === 1 ? "screenshot" : "screenshots";

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

      {screenshotsQuery.data && screenshots.length === 0 && (
        <p className="text-slate-900">
          {projectId
            ? "No screenshots match this filter for this day."
            : "No screenshots captured this day yet — this fills in once screenshots are turned on and a timer is running."}
        </p>
      )}

      {screenshots.length > 0 && (
        <div
          className={clsx(
            "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
            // Room for the floating bar, so it never covers the last row.
            selectedIds.length > 0 && "pb-20",
          )}
        >
          {screenshots.map((screenshot, index) => (
            <ScreenshotTile
              key={screenshot.id}
              organisationId={organisationId}
              screenshot={screenshot}
              priority={index < 3}
              onDelete={
                canDelete ? (id) => setPendingIds([id]) : undefined
              }
              isDeleting={deletingIds.has(screenshot.id)}
              isSelected={selectedIds.includes(screenshot.id)}
              isSelecting={selectedIds.length > 0}
              onSelectedChange={(selected) =>
                setTickedIds((ticked) =>
                  selected
                    ? [...ticked, screenshot.id]
                    : ticked.filter((id) => id !== screenshot.id),
                )
              }
            />
          ))}
        </div>
      )}

      {canDelete && selectedIds.length > 0 && (
        <ScreenshotSelectionBar
          selectedCount={selectedIds.length}
          totalCount={screenshots.length}
          onSelectAll={() => setTickedIds([...visibleIds])}
          onClear={() => setTickedIds([])}
          onDelete={() => setPendingIds(selectedIds)}
        />
      )}

      {pendingIds && (
        <ConfirmDialog
          title={`Delete ${pendingCount} ${pendingNoun}?`}
          message={`This permanently removes the ${pendingCount === 1 ? "image" : "images"} and cannot be undone. The tracked time stays on the timesheet.`}
          confirmLabel={`Delete ${pendingCount} ${pendingNoun}`}
          isDangerous
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingIds)}
          onClose={() => setPendingIds(null)}
        />
      )}
    </div>
  );
}
