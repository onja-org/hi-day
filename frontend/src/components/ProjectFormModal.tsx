"use client";

import type { Project } from "@/types/project";
import { Modal } from "./Modal";
import { ProjectForm } from "./ProjectForm";

type ProjectFormModalProps = {
  organisationId: string;
  project?: Project;
  onClose: () => void;
  onSaved: (project: Project) => void;
};

export function ProjectFormModal({
  organisationId,
  project,
  onClose,
  onSaved,
}: ProjectFormModalProps) {
  return (
    <Modal
      title={project ? "Edit project" : "New project"}
      onClose={onClose}
    >
      {project ? (
        <ProjectForm
          organisationId={organisationId}
          mode="edit"
          project={project}
          onSaved={onSaved}
        />
      ) : (
        <ProjectForm organisationId={organisationId} mode="create" onSaved={onSaved} />
      )}
    </Modal>
  );
}
