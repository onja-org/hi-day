"use client";

import { useProject } from "@/hooks/useProject";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { ProjectMembersSection } from "./ProjectMembersSection";
import { ProjectTeamsSection } from "./ProjectTeamsSection";
import { Spinner } from "./Spinner";

type ProjectAssignmentsModalProps = {
  organisationId: string;
  projectId: string;
  projectName: string;
  kind: "members" | "teams";
  onClose: () => void;
};

/** The project page's Members or Teams section in a modal, so a project's
 * assignments can be edited straight from the Projects list. */
export function ProjectAssignmentsModal({
  organisationId,
  projectId,
  projectName,
  kind,
  onClose,
}: ProjectAssignmentsModalProps) {
  const projectQuery = useProject(organisationId, projectId);

  return (
    <Modal
      title={`Edit ${kind === "members" ? "members" : "teams"} · ${projectName}`}
      onClose={onClose}
      size="wide"
    >
      {projectQuery.isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading…
        </p>
      )}
      {projectQuery.isError && (
        <ErrorMessage
          message={
            projectQuery.error instanceof Error
              ? projectQuery.error.message
              : "Could not load this project."
          }
        />
      )}
      {projectQuery.data && kind === "members" && (
        <ProjectMembersSection
          organisationId={organisationId}
          project={projectQuery.data}
          canManage
        />
      )}
      {projectQuery.data && kind === "teams" && (
        <ProjectTeamsSection
          organisationId={organisationId}
          project={projectQuery.data}
          canManage
        />
      )}
    </Modal>
  );
}
