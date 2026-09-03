"use client";

import { useState } from "react";
import { ProjectFormModal } from "./ProjectFormModal";
import { ProjectsTable } from "./ProjectsTable";
import { RequireRole } from "./RequireRole";

type ProjectsPageContentProps = {
  organisationId: string;
};

export function ProjectsPageContent({ organisationId }: ProjectsPageContentProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-primary-dark">Projects</h1>
        <RequireRole role={["admin", "manager"]}>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="cursor-pointer rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90"
          >
            New project
          </button>
        </RequireRole>
      </div>

      <RequireRole role={["admin", "manager"]}>
        <ProjectsTable organisationId={organisationId} />
      </RequireRole>

      {createOpen && (
        <ProjectFormModal
          organisationId={organisationId}
          onClose={() => setCreateOpen(false)}
          onSaved={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}
