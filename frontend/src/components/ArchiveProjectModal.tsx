"use client";

import { useMutation } from "@tanstack/react-query";
import { useInvalidateProject } from "@/hooks/useInvalidateProject";
import { archiveProject } from "@/lib/archiveProject";
import type { Project } from "@/types/project";
import { ErrorMessage } from "./ErrorMessage";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type ArchiveProjectModalProps = {
  organisationId: string;
  project: Pick<Project, "id" | "name">;
  onClose: () => void;
};

export function ArchiveProjectModal({
  organisationId,
  project,
  onClose,
}: ArchiveProjectModalProps) {
  const invalidate = useInvalidateProject(organisationId, project.id);

  const archiveMutation = useMutation({
    mutationFn: () => archiveProject(organisationId, project.id),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        onClose();
      }
    },
  });
  const failure =
    archiveMutation.data && !archiveMutation.data.ok ? archiveMutation.data.message : null;

  return (
    <Modal title="Archive project" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-slate-900">
          Archiving &ldquo;{project.name}&rdquo; stops it from accepting new
          time. Its history and reports stay intact, and you can unarchive it
          again later.
        </p>

        {failure && <ErrorMessage message={failure} />}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-brand-sm border-2 border-ink px-4 h-11 text-slate-900 font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => archiveMutation.mutate()}
            disabled={archiveMutation.isPending}
            className="flex cursor-pointer items-center gap-2 rounded-brand-sm bg-error px-4 h-11 text-white transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50 border-2 border-ink font-bold"
          >
            {archiveMutation.isPending && <Spinner />}
            Archive project
          </button>
        </div>
      </div>
    </Modal>
  );
}
