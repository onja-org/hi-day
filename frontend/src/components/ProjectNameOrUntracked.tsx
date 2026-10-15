"use client";

import { useProjects } from "@/hooks/useProjects";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";

type ProjectNameOrUntrackedProps = {
  organisationId: string;
  projectId: string | null;
};

export function ProjectNameOrUntracked({
  organisationId,
  projectId,
}: ProjectNameOrUntrackedProps) {
  const projectsEnabled = useProjectsEnabled();
  const projectsQuery = useProjects(organisationId, { status: "all" });
  const project = projectId
    ? projectsQuery.data?.find((candidate) => candidate.id === projectId)
    : undefined;

  // Without Projects every row would read "No project", which is noise rather
  // than information.
  if (!projectsEnabled) return null;

  if (!project) {
    return <span className="text-slate-900/50">No project</span>;
  }

  return <span className="text-slate-900">{project.name}</span>;
}
