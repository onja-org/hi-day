"use client";

import { useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import type { ProjectStatus } from "@/types/project";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectRow } from "./ProjectRow";
import { Spinner } from "./Spinner";

type ProjectsTableProps = {
  organisationId: string;
};

const STATUS_FILTERS: (ProjectStatus | "all")[] = ["all", "active", "archived"];

export function ProjectsTable({ organisationId }: ProjectsTableProps) {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("active");
  const [client, setClient] = useState("");
  const projectsQuery = useProjects(organisationId, {
    status: statusFilter,
    client: client.trim() || undefined,
  });

  if (projectsQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading projects…
      </p>
    );
  }

  if (projectsQuery.isError || !projectsQuery.data) {
    return (
      <ErrorMessage
        message={
          projectsQuery.error instanceof Error
            ? projectsQuery.error.message
            : "Could not load projects."
        }
      />
    );
  }

  const projects = projectsQuery.data;
  const hasFilters = statusFilter !== "active" || client.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="project-client-filter" className="sr-only">
          Filter by client
        </label>
        <input
          id="project-client-filter"
          type="search"
          placeholder="Filter by client"
          value={client}
          onChange={(event) => setClient(event.target.value)}
          className="rounded-md border border-input-border px-3 py-2 text-sm text-slate-900 sm:w-64"
        />
        <label htmlFor="project-status-filter" className="sr-only">
          Filter by status
        </label>
        <select
          id="project-status-filter"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as ProjectStatus | "all")
          }
          className="rounded-md border border-input-border px-3 py-2 text-sm text-slate-900"
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "All statuses" : status}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border border-input-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-input-border text-slate-900">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Rate</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                organisationId={organisationId}
                project={project}
              />
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-900">
                  {hasFilters
                    ? "No projects match your filters."
                    : "No projects yet. Create one to start tracking time against real work."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
