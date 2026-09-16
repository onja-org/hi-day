"use client";

import { useProjects } from "@/hooks/useProjects";

export const UNTRACKED_PROJECT_VALUE = "untracked";

type ProjectFilterSelectProps = {
  organisationId: string;
  /** "" = all projects, UNTRACKED_PROJECT_VALUE = no covering time entry,
   * anything else = a real project id. */
  value: string;
  onChange: (value: string) => void;
};

/**
 * Filters Apps/URLs/Screenshots activity by the real project a `TimeEntry`
 * was covering at the time — not a fabricated field. Most rows have no
 * covering entry at all (the desktop agent tracks continuously; a
 * TimeEntry only exists while a timer runs), so "Untracked" is a
 * first-class option here, not an edge case.
 */
export function ProjectFilterSelect({
  organisationId,
  value,
  onChange,
}: ProjectFilterSelectProps) {
  const projectsQuery = useProjects(organisationId, { status: "active" });

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-input-border bg-white px-3 py-1.5 text-sm text-slate-900"
    >
      <option value="">All projects</option>
      {projectsQuery.data?.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
      <option value={UNTRACKED_PROJECT_VALUE}>Untracked</option>
    </select>
  );
}
