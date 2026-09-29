"use client";

import { useProjects } from "@/hooks/useProjects";
import { SearchableSelect } from "./SearchableSelect";

type ProjectFilterSelectProps = {
  organisationId: string;
  /** "" = all projects, anything else = a real project id. */
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
    <SearchableSelect
      value={value}
      onChange={onChange}
      ariaLabel="Filter by project"
      placeholder="Search projects…"
      noMatchesLabel="No matching projects"
      options={[
        { value: "", label: "All projects" },
        ...(projectsQuery.data?.map((project) => ({ value: project.id, label: project.name })) ?? []),
        { value: UNTRACKED_PROJECT_VALUE, label: "Untracked" },
      ]}
    />
  );
}
