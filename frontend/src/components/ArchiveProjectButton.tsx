"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { archiveProject } from "@/lib/archiveProject";
import { unarchiveProject } from "@/lib/unarchiveProject";
import { PROJECT_QUERY_KEY } from "@/hooks/useProject";
import type { Project } from "@/types/project";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type ArchiveProjectButtonProps = {
  organisationId: string;
  project: Pick<Project, "id" | "name" | "status">;
};

export function ArchiveProjectButton({
  organisationId,
  project,
}: ArchiveProjectButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["projects", organisationId] });
    queryClient.invalidateQueries({
      queryKey: PROJECT_QUERY_KEY(organisationId, project.id),
    });
  }

  const archiveMutation = useMutation({
    mutationFn: () => archiveProject(organisationId, project.id),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
        setConfirming(false);
      }
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: () => unarchiveProject(organisationId, project.id),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
      }
    },
  });

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
        <Modal title="Archive project" onClose={() => setConfirming(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-slate-900">
              Archiving &ldquo;{project.name}&rdquo; stops it from accepting
              new time. Its history and reports stay intact, and you can
              unarchive it again later.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="cursor-pointer rounded-md border border-input-border px-4 py-2 text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-error px-4 py-2 text-white transition-colors duration-150 hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {archiveMutation.isPending && <Spinner />}
                Archive project
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
