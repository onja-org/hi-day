"use client";

import { useState } from "react";
import type { ProjectOverviewItem, ProjectStatus } from "@/types/project";
import { BatchEditProjectsModal } from "./BatchEditProjectsModal";
import { BatchProjectActionModal } from "./BatchProjectActionModal";

type ProjectBatchActionsProps = {
  organisationId: string;
  status: ProjectStatus;
  selected: ProjectOverviewItem[];
  onClearSelection: () => void;
};

type OpenBatch = { kind: "edit" | "archive" | "delete"; projects: ProjectOverviewItem[] };

/** The bar shown while projects are ticked, plus the batch modal it opens.
 * The modal keeps its own copy of the selection, so clearing the selection
 * once the batch runs doesn't close it before the results show. */
export function ProjectBatchActions({
  organisationId,
  status,
  selected,
  onClearSelection,
}: ProjectBatchActionsProps) {
  const [open, setOpen] = useState<OpenBatch | null>(null);
  const start = (kind: OpenBatch["kind"]) => setOpen({ kind, projects: selected });
  const close = () => setOpen(null);

  return (
    <>
      {selected.length > 0 && (
        <section
          aria-label="Batch actions"
          className="flex flex-wrap items-center gap-3 rounded-md bg-cream/60 px-4 py-2 text-sm"
        >
          <span className="font-medium text-primary-dark">{selected.length} selected</span>
          {/* Archived projects can't be changed until unarchived, so only
              delete applies to them. */}
          {status === "active" && (
            <>
              <button
                type="button"
                onClick={() => start("edit")}
                className="cursor-pointer rounded-md border border-input-border bg-white px-3 h-11 text-slate-900 hover:bg-cream"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => start("archive")}
                className="cursor-pointer rounded-md border border-input-border bg-white px-3 h-11 text-slate-900 hover:bg-cream"
              >
                Archive
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => start("delete")}
            className="cursor-pointer rounded-md border border-error bg-white px-3 h-11 text-error hover:bg-error/10"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="ml-auto cursor-pointer text-primary hover:text-primary/80"
          >
            Clear selection
          </button>
        </section>
      )}

      {open?.kind === "edit" && (
        <BatchEditProjectsModal
          organisationId={organisationId}
          projects={open.projects}
          onClose={close}
          onDone={onClearSelection}
        />
      )}
      {(open?.kind === "archive" || open?.kind === "delete") && (
        <BatchProjectActionModal
          organisationId={organisationId}
          kind={open.kind}
          projects={open.projects}
          onClose={close}
          onDone={onClearSelection}
        />
      )}
    </>
  );
}
