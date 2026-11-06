"use client";

import { useProjects } from "@/hooks/useProjects";
import { describeScreenshotDeletion } from "@/lib/describeScreenshotDeletion";
import type { ScreenshotSummaryItem } from "@/types/screenshot";
import { ConfirmDialog } from "./ConfirmDialog";

type ScreenshotDeleteDialogProps = {
  organisationId: string;
  /** What confirming would delete — one tile's, or the whole selection. */
  screenshots: ScreenshotSummaryItem[];
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ScreenshotDeleteDialog({
  organisationId,
  screenshots,
  isPending,
  onConfirm,
  onClose,
}: ScreenshotDeleteDialogProps) {
  // "all" so a since-archived project still resolves to its name.
  const projects = useProjects(organisationId, { status: "all" }).data;
  const message = describeScreenshotDeletion(
    screenshots,
    (projectId) => projects?.find((project) => project.id === projectId)?.name,
  );
  const count = screenshots.length;
  const noun = count === 1 ? "screenshot" : "screenshots";

  return (
    <ConfirmDialog
      title={`Delete ${count} ${noun}?`}
      message={message}
      confirmLabel={`Delete ${count} ${noun}`}
      isDangerous
      isPending={isPending}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
