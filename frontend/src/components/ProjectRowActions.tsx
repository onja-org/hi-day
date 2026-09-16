"use client";

import { useState } from "react";
import { PencilSimple, UserPlus, UsersThree } from "@phosphor-icons/react";
import type { ProjectListItem } from "@/types/project";
import { AddProjectMemberModal } from "./AddProjectMemberModal";
import { AddProjectTeamModal } from "./AddProjectTeamModal";
import { ArchiveProjectButton } from "./ArchiveProjectButton";
import { ProjectFormModal } from "./ProjectFormModal";

type ProjectRowActionsProps = {
  organisationId: string;
  project: ProjectListItem;
};

export function ProjectRowActions({ organisationId, project }: ProjectRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const isArchived = project.status === "archived";
  const archivedTitle = isArchived ? "Unarchive this project to change it." : undefined;

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        disabled={isArchived}
        title={archivedTitle ?? "Edit project"}
        aria-label="Edit project"
        className="cursor-pointer text-primary-dark transition-colors duration-150 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <PencilSimple size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setAddMemberOpen(true)}
        disabled={isArchived}
        title={archivedTitle ?? "Add member"}
        aria-label="Add member"
        className="cursor-pointer text-primary-dark transition-colors duration-150 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <UserPlus size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setAddTeamOpen(true)}
        disabled={isArchived}
        title={archivedTitle ?? "Add team"}
        aria-label="Add team"
        className="cursor-pointer text-primary-dark transition-colors duration-150 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <UsersThree size={18} aria-hidden="true" />
      </button>
      <ArchiveProjectButton organisationId={organisationId} project={project} />

      {editOpen && (
        <ProjectFormModal
          organisationId={organisationId}
          project={project}
          onClose={() => setEditOpen(false)}
          onSaved={() => setEditOpen(false)}
        />
      )}
      {addMemberOpen && (
        <AddProjectMemberModal
          organisationId={organisationId}
          projectId={project.id}
          onClose={() => setAddMemberOpen(false)}
        />
      )}
      {addTeamOpen && (
        <AddProjectTeamModal
          organisationId={organisationId}
          projectId={project.id}
          onClose={() => setAddTeamOpen(false)}
        />
      )}
    </div>
  );
}
