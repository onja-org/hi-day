"use client";

import { useProjects } from "@/hooks/useProjects";
import { MultiSelectDropdown } from "./MultiSelectDropdown";

type InviteProjectsFieldProps = {
  organisationId: string;
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
};

/** Projects an invitee joins (as a project member) once they accept. */
export function InviteProjectsField({
  organisationId,
  selectedIds,
  onChange,
}: InviteProjectsFieldProps) {
  const projectsQuery = useProjects(organisationId, { status: "active" });
  const projects = projectsQuery.data ?? [];

  function toggle(projectId: string) {
    const next = new Set(selectedIds);
    if (next.has(projectId)) next.delete(projectId);
    else next.add(projectId);
    onChange(next);
  }

  const triggerText =
    selectedIds.size === 0
      ? "No projects"
      : `${selectedIds.size} ${selectedIds.size === 1 ? "project" : "projects"} selected`;

  return (
    <MultiSelectDropdown
      id="invite-projects"
      label="Projects (optional)"
      triggerText={projectsQuery.isLoading ? "Loading projects…" : triggerText}
      disabled={projectsQuery.isLoading || projects.length === 0}
    >
      <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {projects.map((project) => (
          <li key={project.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-900 hover:bg-cream">
              <input
                type="checkbox"
                checked={selectedIds.has(project.id)}
                onChange={() => toggle(project.id)}
                className="accent-primary"
              />
              {project.name}
            </label>
          </li>
        ))}
      </ul>
    </MultiSelectDropdown>
  );
}
