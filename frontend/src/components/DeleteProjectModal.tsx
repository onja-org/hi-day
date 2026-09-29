"use client";

import { useMutation } from "@tanstack/react-query";
import { useInvalidateProjects } from "@/hooks/useInvalidateProjects";
import { deleteProject } from "@/lib/deleteProject";
import type { Project } from "@/types/project";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type DeleteProjectModalProps = {
  organisationId: string;
  project: Pick<Project, "id" | "name" | "status">;
  onClose: () => void;
  /** Offered when the backend refuses because the project has logged time. */
  onArchiveInstead: () => void;
};

export function DeleteProjectModal({
  organisationId,
  project,
  onClose,
  onArchiveInstead,
}: DeleteProjectModalProps) {
  const invalidateProjects = useInvalidateProjects(organisationId);

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(organisationId, project.id),
    onSuccess: (result) => {
      if (result.ok) {
        invalidateProjects();
        onClose();
      }
    },
  });
  const failure =
    deleteMutation.data && !deleteMutation.data.ok ? deleteMutation.data.message : null;

  return (
    <Modal title="Delete project" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-slate-900">
          Deleting &ldquo;{project.name}&rdquo; permanently removes it, its tasks and its
          member and team assignments. This can&rsquo;t be undone. A project with time logged
          against it can only be archived.
        </p>

        {failure && <ErrorMessage message={failure} />}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-input-border px-4 py-2 text-slate-900"
          >
            Cancel
          </button>
          {failure && project.status === "active" ? (
            <button
              type="button"
              onClick={onArchiveInstead}
              className="cursor-pointer rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90"
            >
              Archive instead
            </button>
          ) : (
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || failure !== null}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-error px-4 py-2 text-white transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteMutation.isPending && <Spinner />}
              Delete project
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
