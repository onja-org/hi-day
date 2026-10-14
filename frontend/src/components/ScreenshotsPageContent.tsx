"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActivityDayFilters } from "@/hooks/useActivityDayFilters";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { deleteScreenshot } from "@/lib/deleteScreenshot";
import { ErrorMessage } from "./ErrorMessage";
import { useActivityScreenshots } from "@/hooks/useActivityScreenshots";
import { ActivityFilterToolbar } from "./ActivityFilterToolbar";
import { ActivityQueryStatus } from "./ActivityQueryStatus";
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
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Resolved server-side: an admin always, everyone else only where the
  // organisation (or their own override) allows it.
  const canDelete =
    useCurrentOrganisation().data?.canDeleteOwnScreenshots ?? false;

  const deleteMutation = useMutation({
    mutationFn: (screenshotId: string) =>
      deleteScreenshot(organisationId, screenshotId),
    onMutate: () => setDeleteError(null),
    onSuccess: async (result) => {
      if (!result.ok) {
        setDeleteError(result.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["screenshots"] });
    },
  });
  const deletingId = deleteMutation.isPending
    ? deleteMutation.variables
    : null;

  return (
    <div className="flex flex-col gap-4">
      <ActivityFilterToolbar
        organisationId={organisationId}
        canViewOthers={canViewOthers}
      />

      {deleteError && <ErrorMessage message={deleteError} />}

      <ActivityQueryStatus
        isLoading={screenshotsQuery.isLoading}
        isError={screenshotsQuery.isError}
        error={screenshotsQuery.error}
        loadingLabel="Loading screenshots…"
        errorFallback="Could not load screenshots."
      />

      {screenshotsQuery.data && screenshotsQuery.data.length === 0 && (
        <p className="text-slate-900">
          {projectId
            ? "No screenshots match this filter for this day."
            : "No screenshots captured this day yet — this fills in once screenshots are turned on and a timer is running."}
        </p>
      )}

      {screenshotsQuery.data && screenshotsQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {screenshotsQuery.data.map((screenshot, index) => (
            <ScreenshotTile
              key={screenshot.id}
              organisationId={organisationId}
              screenshot={screenshot}
              priority={index < 3}
              onDelete={canDelete ? deleteMutation.mutate : undefined}
              isDeleting={deletingId === screenshot.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
