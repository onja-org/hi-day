"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useProjects } from "@/hooks/useProjects";
import { filterProjectsByName } from "@/lib/filterProjectsByName";
import type { ProjectStatus } from "@/types/project";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectRow } from "./ProjectRow";
import { PageTabs } from "./PageTabs";
import { SearchInput } from "./SearchInput";
import { Spinner } from "./Spinner";

type ProjectsTableProps = {
  organisationId: string;
  /** Rendered at the right of the search bar, e.g. an "Add project" button. */
  actions?: ReactNode;
};

export function ProjectsTable({ organisationId, actions }: ProjectsTableProps) {
  const [statusTab, setStatusTab] = useState<ProjectStatus>("active");
  const [search, setSearch] = useState("");
  // Fetches every status at once so both tabs can show their counts.
  const projectsQuery = useProjects(organisationId, { status: "all" });
  const organisationQuery = useCurrentOrganisation();
  const canManage =
    organisationQuery.data?.role === "admin" ||
    organisationQuery.data?.role === "manager";

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

  const allProjects = projectsQuery.data;
  const counts: Record<ProjectStatus, number> = {
    active: allProjects.filter((project) => project.status === "active").length,
    archived: allProjects.filter((project) => project.status === "archived").length,
  };
  const projects = filterProjectsByName(
    allProjects.filter((project) => project.status === statusTab),
    search,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageTabs
        tabs={[
          { key: "active", label: "Active", count: counts.active },
          { key: "archived", label: "Archived", count: counts.archived },
        ]}
        active={statusTab}
        onChange={setStatusTab}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects" />
        {actions}
      </div>

      {/* No horizontal scroll wrapper: it would also clip a last row's
          Actions menu vertically. Secondary columns hide on narrow screens
          instead (see ProjectRow). */}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-input-border text-primary-dark">
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Teams</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Members</th>
            <th className="hidden px-4 py-3 font-semibold sm:table-cell">Tasks</th>
            <th className="px-4 py-3 font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              organisationId={organisationId}
              project={project}
              canManage={canManage}
            />
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-900">
                {search.trim() && "No projects match your search."}
                {!search.trim() && statusTab === "archived" && "No archived projects."}
                {!search.trim() &&
                  statusTab === "active" &&
                  "No projects yet. Create one to start tracking time against real work."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
