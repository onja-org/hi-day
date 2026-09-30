"use client";

import { useState } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { ImportProjectsModal } from "@/components/ImportProjectsModal";
import { ProjectFormModal } from "@/components/ProjectFormModal";
import { ProjectsTable } from "@/components/ProjectsTable";

type ProjectsPageContentProps = {
  organisationId: string;
};

export function ProjectsPageContent({ organisationId }: ProjectsPageContentProps) {
  const organisationQuery = useCurrentOrganisation();
  const canCreate =
    organisationQuery.data?.role === "admin" ||
    organisationQuery.data?.role === "manager";
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-dark">Projects</h1>

      <ProjectsTable
        organisationId={organisationId}
        actions={
          canCreate && (
            <div className="flex shrink-0 gap-3">
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="cursor-pointer rounded-md border border-primary px-5 h-11 text-sm font-medium text-primary transition-colors duration-150 hover:bg-primary/10"
              >
                Import projects
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="cursor-pointer rounded-md bg-primary px-5 h-11 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary/90"
              >
                Add project
              </button>
            </div>
          )
        }
      />

      {createOpen && (
        <ProjectFormModal
          organisationId={organisationId}
          onClose={() => setCreateOpen(false)}
          onSaved={() => setCreateOpen(false)}
        />
      )}
      {importOpen && (
        <ImportProjectsModal organisationId={organisationId} onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}
