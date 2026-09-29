"use client";

import { useState } from "react";
import { useUnarchiveProject } from "@/hooks/useUnarchiveProject";
import type { ProjectListItem } from "@/types/project";
import { ActionsMenu } from "./ActionsMenu";
import { AddProjectMemberModal } from "./AddProjectMemberModal";
import { AddProjectTeamModal } from "./AddProjectTeamModal";
import { ArchiveProjectModal } from "./ArchiveProjectModal";
import { DeleteProjectModal } from "./DeleteProjectModal";
import { ProjectFormModal } from "./ProjectFormModal";

type ProjectRowActionsProps = {
  organisationId: string;
  project: ProjectListItem;
};

type OpenModal = "edit" | "addMembers" | "addTeam" | "archive" | "delete" | null;

export function ProjectRowActions({ organisationId, project }: ProjectRowActionsProps) {
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const unarchiveMutation = useUnarchiveProject(organisationId, project.id);
  const isArchived = project.status === "archived";
  const archivedTitle = isArchived ? "Unarchive this project to change it." : undefined;
  const closeModal = () => setOpenModal(null);

  return (
    <>
      <ActionsMenu
        items={[
          {
            label: "Edit project",
            onSelect: () => setOpenModal("edit"),
            disabled: isArchived,
            title: archivedTitle,
          },
          {
            label: "Add members",
            onSelect: () => setOpenModal("addMembers"),
            disabled: isArchived,
            title: archivedTitle,
          },
          {
            label: "Add team",
            onSelect: () => setOpenModal("addTeam"),
            disabled: isArchived,
            title: archivedTitle,
          },
          {
            label: "Manage members",
            href: `/organisations/${organisationId}/projects/${project.id}`,
          },
          isArchived
            ? {
                label: "Unarchive project",
                onSelect: () => unarchiveMutation.mutate(),
                disabled: unarchiveMutation.isPending,
              }
            : {
                label: "Archive project",
                onSelect: () => setOpenModal("archive"),
                tone: "danger",
              },
          {
            label: "Delete project",
            onSelect: () => setOpenModal("delete"),
            tone: "danger",
          },
        ]}
      />

      {openModal === "edit" && (
        <ProjectFormModal
          organisationId={organisationId}
          project={project}
          onClose={closeModal}
          onSaved={closeModal}
        />
      )}
      {openModal === "addMembers" && (
        <AddProjectMemberModal
          organisationId={organisationId}
          projectId={project.id}
          onClose={closeModal}
        />
      )}
      {openModal === "addTeam" && (
        <AddProjectTeamModal
          organisationId={organisationId}
          projectId={project.id}
          onClose={closeModal}
        />
      )}
      {openModal === "delete" && (
        <DeleteProjectModal
          organisationId={organisationId}
          project={project}
          onClose={closeModal}
          onArchiveInstead={() => setOpenModal("archive")}
        />
      )}
      {openModal === "archive" && (
        <ArchiveProjectModal
          organisationId={organisationId}
          project={project}
          onClose={closeModal}
        />
      )}
    </>
  );
}
