"use client";

import { useState } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { ProjectFormModal } from "./ProjectFormModal";
import { ProjectsTable } from "./ProjectsTable";

type ProjectsPageContentProps = {
  organisationId: string;
};

export function ProjectsPageContent({ organisationId }: ProjectsPageContentProps) {
  const organisationQuery = useCurrentOrganisation();
  const canCreate =
    organisationQuery.data?.role === "admin" ||
    organisationQuery.data?.role === "manager";
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary-dark">Projects</h1>

      <ProjectsTable
        organisationId={organisationId}
        actions={
          canCreate && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="shrink-0 cursor-pointer rounded-md bg-primary px-5 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary/90"
            >
              Add project
            </button>
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
    </div>
  );
}
