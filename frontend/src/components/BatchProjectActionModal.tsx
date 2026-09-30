"use client";

import { useMutation } from "@tanstack/react-query";
import { useInvalidateProjects } from "@/hooks/useInvalidateProjects";
import { archiveProject } from "@/lib/archiveProject";
import { deleteProject } from "@/lib/deleteProject";
import { runProjectBatch } from "@/lib/runProjectBatch";
import type { ProjectListItem } from "@/types/project";
import { Modal } from "./Modal";
import { ProjectBatchResultsList } from "./ProjectBatchResultsList";
import { Spinner } from "./Spinner";

type BatchProjectActionModalProps = {
  organisationId: string;
  kind: "archive" | "delete";
  projects: ProjectListItem[];
  onClose: () => void;
  /** Called once the batch has run, e.g. to clear the selection. */
  onDone: () => void;
};

export function BatchProjectActionModal({
  organisationId,
  kind,
  projects,
  onClose,
  onDone,
}: BatchProjectActionModalProps) {
  const invalidateProjects = useInvalidateProjects(organisationId);
  const count = `${projects.length} ${projects.length === 1 ? "project" : "projects"}`;

  const mutation = useMutation({
    mutationFn: () =>
      runProjectBatch(projects, (project) =>
        kind === "archive"
          ? archiveProject(organisationId, project.id)
          : deleteProject(organisationId, project.id),
        kind === "archive" ? "Archived" : "Deleted",
      ),
    onSettled: () => {
      invalidateProjects();
      onDone();
    },
  });

  return (
    <Modal title={kind === "archive" ? "Archive projects" : "Delete projects"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {mutation.data ? (
          <ProjectBatchResultsList outcomes={mutation.data.outcomes} />
        ) : (
          <p className="text-slate-900">
            {kind === "archive"
              ? `Archiving ${count} stops them from accepting new time. Their history stays intact, and you can unarchive them later. A project with a timer running is skipped.`
              : `Deleting ${count} permanently removes them, their tasks and their assignments. This can't be undone. A project with time logged against it is skipped — archive it instead.`}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-input-border px-4 h-11 text-slate-900"
          >
            {mutation.data ? "Done" : "Cancel"}
          </button>
          {!mutation.data && (
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-error px-4 h-11 text-white transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending && <Spinner />}
              {kind === "archive" ? `Archive ${count}` : `Delete ${count}`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
