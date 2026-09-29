"use client";

import { useState } from "react";
import { useUnarchiveProject } from "@/hooks/useUnarchiveProject";
import type { Project } from "@/types/project";
import { ArchiveProjectModal } from "./ArchiveProjectModal";

type ArchiveProjectButtonProps = {
  organisationId: string;
  project: Pick<Project, "id" | "name" | "status">;
};

export function ArchiveProjectButton({
  organisationId,
  project,
}: ArchiveProjectButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const unarchiveMutation = useUnarchiveProject(organisationId, project.id);

  if (project.status === "archived") {
    return (
      <button
        type="button"
        onClick={() => unarchiveMutation.mutate()}
        disabled={unarchiveMutation.isPending}
        className="cursor-pointer text-primary underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        Unarchive
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="cursor-pointer text-error underline"
      >
        Archive
      </button>

      {confirming && (
        <ArchiveProjectModal
          organisationId={organisationId}
          project={project}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
