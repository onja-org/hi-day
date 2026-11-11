"use client";

import { useState } from "react";
import clsx from "clsx";
import { useActivityDayFilters } from "@/hooks/useActivityDayFilters";
import { useActivityScreenshots } from "@/hooks/useActivityScreenshots";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useDeleteScreenshots } from "@/hooks/useDeleteScreenshots";
import { canDeleteShownScreenshots } from "@/lib/canDeleteShownScreenshots";
import { ActivityFilterToolbar } from "./ActivityFilterToolbar";
import { ActivityQueryStatus } from "./ActivityQueryStatus";
import { ScreenshotDeleteDialog } from "./ScreenshotDeleteDialog";
import { ScreenshotGrid } from "./ScreenshotGrid";
import { ScreenshotSelectionBar } from "./ScreenshotSelectionBar";
import { Pagination } from "./Pagination";
import { ScreenshotSlotsView } from "./ScreenshotSlotsView";
import { SegmentedControl } from "./SegmentedControl";

type ScreenshotsPageContentProps = {
  organisationId: string;
};

/** "Every 10 min" is the default — the images alone never said how active
 * somebody was or how long they worked. */
type ScreenshotsView = "slots" | "all";

const VIEW_OPTIONS: { key: ScreenshotsView; label: string }[] = [
  { key: "slots", label: "Every 10 min" },
  { key: "all", label: "All screenshots" },
];

export function ScreenshotsPageContent({
  organisationId,
}: ScreenshotsPageContentProps) {
  const { date, membershipId, projectId, canViewOthers } =
    useActivityDayFilters();
  const [view, setView] = useState<ScreenshotsView>("slots");

  // Back to page 1 whenever the gallery itself changes — derived rather
  // than reset in an effect, the same way the selection is below.
  const galleryKey = [date, membershipId, projectId].join("|");
  const [paging, setPaging] = useState({ galleryKey, page: 1 });
  const requestedPage = paging.galleryKey === galleryKey ? paging.page : 1;

  const screenshotsQuery = useActivityScreenshots(
    organisationId,
    { date, membershipId, projectId },
    // Newest first, the order the 10-minute view pages its hours in.
    { page: requestedPage, newestFirst: true },
    // Presigned URLs and full-size downloads — not worth paying for while
    // the other view is showing.
    { enabled: view === "all" },
  );
  const [tickedIds, setTickedIds] = useState<string[]>([]);
  /** What the open confirmation would delete — one id from a tile's
   * button, or the whole selection. */
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  // canDeleteOwnScreenshots is resolved server-side: an admin always,
  // everyone else only where the organisation (or their own override)
  // allows it. Whose gallery is on screen decides the rest.
  const organisation = useCurrentOrganisation().data;
  const canDelete = canDeleteShownScreenshots({
    role: organisation?.role,
    canDeleteOwnScreenshots: organisation?.canDeleteOwnScreenshots ?? false,
    viewedMembershipId: membershipId,
  });

  const deleteMutation = useDeleteScreenshots(organisationId, () => {
    setPendingIds(null);
    setTickedIds([]);
  });

  const screenshotsPage = screenshotsQuery.data;
  const screenshots = screenshotsPage?.items ?? [];
  // Derived, not reset in an effect: a tick left over from another day
  // or filter would delete something the user can no longer see.
  const visibleIds = new Set(screenshots.map((screenshot) => screenshot.id));
  const selectedIds = tickedIds.filter((id) => visibleIds.has(id));
  const deletingIds = deleteMutation.isPending
    ? new Set(deleteMutation.variables)
    : new Set<string>();

  return (
    <div
      className={clsx(
        "flex flex-col gap-4",
        // Room for the floating bar, so it never covers the last row or
        // the pager under it.
        selectedIds.length > 0 && "pb-20",
      )}
    >
      <ActivityFilterToolbar
        organisationId={organisationId}
        canViewOthers={canViewOthers}
      />

      <SegmentedControl
        label="Screenshots view"
        options={VIEW_OPTIONS}
        value={view}
        onChange={setView}
      />

      {view === "slots" && (
        <ScreenshotSlotsView
          organisationId={organisationId}
          date={date}
          membershipId={membershipId}
          projectId={projectId}
        />
      )}

      {view === "all" && (
        <>
        <ActivityQueryStatus
          isLoading={screenshotsQuery.isLoading}
          isError={screenshotsQuery.isError}
          error={screenshotsQuery.error}
          loadingLabel="Loading screenshots…"
          errorFallback="Could not load screenshots."
        />

        {screenshotsPage && screenshots.length === 0 && (
          <p className="text-slate-900">
            {projectId
              ? "No screenshots match this filter for this day."
              : "No screenshots captured this day yet — this fills in once screenshots are turned on and a timer is running."}
          </p>
        )}

        {screenshots.length > 0 && (
          <ScreenshotGrid
            organisationId={organisationId}
            screenshots={screenshots}
            isStale={screenshotsQuery.isPlaceholderData}
            onDelete={canDelete ? (id) => setPendingIds([id]) : undefined}
            deletingIds={deletingIds}
            selectedIds={selectedIds}
            onSelectedChange={(id, selected) =>
              setTickedIds((ticked) =>
                selected ? [...ticked, id] : ticked.filter((tick) => tick !== id),
              )
            }
          />
        )}

        {screenshotsPage && (
          <Pagination
            label="Screenshot pages"
            page={screenshotsPage.page}
            pageSize={screenshotsPage.pageSize}
            total={screenshotsPage.total}
            isFetching={screenshotsQuery.isPlaceholderData}
            onPageChange={(page) => {
              // A selection is per page: nothing ticked out of sight.
              setTickedIds([]);
              setPaging({ galleryKey, page });
            }}
          />
        )}
        </>
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
        <ScreenshotDeleteDialog
          organisationId={organisationId}
          screenshots={screenshots.filter((screenshot) =>
            pendingIds.includes(screenshot.id),
          )}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingIds)}
          onClose={() => setPendingIds(null)}
        />
      )}
    </div>
  );
}
