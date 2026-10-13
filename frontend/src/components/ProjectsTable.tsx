"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { useProjects } from "@/hooks/useProjects";
import { filterProjectsByName } from "@/lib/filterProjectsByName";
import type { ProjectStatus } from "@/types/project";
import { ErrorMessage } from "@/components/ErrorMessage";
import { PageTabs } from "@/components/PageTabs";
import { ProjectBatchActions } from "@/components/ProjectBatchActions";
import { ProjectRow } from "@/components/ProjectRow";
import { SearchInput } from "@/components/SearchInput";
import { SelectAllCheckbox } from "@/components/SelectAllCheckbox";
import { Spinner } from "@/components/Spinner";

type ProjectsTableProps = {
  organisationId: string;
  actions?: ReactNode;
};

export function ProjectsTable({ organisationId, actions }: ProjectsTableProps) {
  const [statusTab, setStatusTab] = useState<ProjectStatus>("active");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Fetches every status at once so both tabs can show their counts.
  const projectsQuery = useProjects(organisationId, { status: "all" });
  const organisationQuery = useCurrentOrganisation();
  const canManageAll =
    organisationQuery.data?.role === "admin" ||
    organisationQuery.data?.role === "manager";
  const callerUserId = organisationQuery.data?.userId;

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
    archived: allProjects.filter((project) => project.status === "archived")
      .length,
  };
  const projects = filterProjectsByName(
    allProjects.filter((project) => project.status === statusTab),
    search,
  );
  // Only rows on screen count, so a search can't hide a ticked project
  // that a batch action would still touch.
  const selected = projects.filter((project) => selectedIds.has(project.id));
  const columnCount = canManageAll ? 6 : 5;

  function toggleSelected(projectId: string) {
    const next = new Set(selectedIds);
    if (next.has(projectId)) next.delete(projectId);
    else next.add(projectId);
    setSelectedIds(next);
  }

  function changeTab(tab: ProjectStatus) {
    setStatusTab(tab);
    setSelectedIds(new Set());
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTabs
        tabs={[
          { key: "active", label: "Active", count: counts.active },
          { key: "archived", label: "Archived", count: counts.archived },
        ]}
        active={statusTab}
        onChange={changeTab}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects" />
        {actions}
      </div>

      {canManageAll && (
        <ProjectBatchActions
          organisationId={organisationId}
          status={statusTab}
          selected={selected}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}

      {/* No horizontal scroll wrapper: it would also clip a last row's
          Actions menu vertically. Secondary columns hide on narrow screens
          instead (see ProjectRow). */}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-input-border text-primary-dark">
            {canManageAll && (
              <th className="w-10 py-3 pl-4">
                <SelectAllCheckbox
                  label="Select all projects"
                  selectedCount={selected.length}
                  totalCount={projects.length}
                  onChange={(selectAll) =>
                    setSelectedIds(new Set(selectAll ? projects.map((project) => project.id) : []))
                  }
                />
              </th>
            )}
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">
              Teams
            </th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">
              Members
            </th>
            <th className="hidden px-4 py-3 font-semibold sm:table-cell">
              Tasks
            </th>
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
              canSelect={canManageAll}
              canManage={
                canManageAll ||
                project.members.some(
                  (member) => member.userId === callerUserId && member.role === "manager",
                )
              }
              columnCount={columnCount}
              selected={selectedIds.has(project.id)}
              onToggleSelected={() => toggleSelected(project.id)}
            />
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="px-4 py-8 text-center text-slate-900">
                {search.trim() && "No projects match your search."}
                {!search.trim() &&
                  statusTab === "archived" &&
                  "No archived projects."}
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
