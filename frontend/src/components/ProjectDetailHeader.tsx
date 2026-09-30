"use client";

import { useState } from "react";
import { ArchiveProjectButton } from "./ArchiveProjectButton";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { ProjectFormModal } from "./ProjectFormModal";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import type { ProjectDetail } from "@/types/project";

type ProjectDetailHeaderProps = {
  organisationId: string;
  project: ProjectDetail;
  canManage: boolean;
};

export function ProjectDetailHeader({
  organisationId,
  project,
  canManage,
}: ProjectDetailHeaderProps) {
  const [editOpen, setEditOpen] = useState(false);
  const isArchived = project.status === "archived";

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <ProjectColourBadge colour={project.colour} className="h-4 w-4" />
        <h1 className="text-2xl font-semibold text-primary-dark">{project.name}</h1>
        <ProjectStatusBadge status={project.status} />
      </div>
      {canManage && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            disabled={isArchived}
            title={isArchived ? "Unarchive this project to edit it." : undefined}
            className="cursor-pointer rounded-md border border-primary px-3 h-11 text-sm text-primary transition-colors duration-150 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit
          </button>
          <ArchiveProjectButton organisationId={organisationId} project={project} />
        </div>
      )}

      {editOpen && (
        <ProjectFormModal
          organisationId={organisationId}
          project={project}
          onClose={() => setEditOpen(false)}
          onSaved={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
