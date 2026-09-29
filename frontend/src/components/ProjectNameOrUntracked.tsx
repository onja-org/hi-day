"use client";

import { useProjects } from "@/hooks/useProjects";

type ProjectNameOrUntrackedProps = {
  organisationId: string;
  projectId: string | null;
};

export function ProjectNameOrUntracked({
  organisationId,
  projectId,
}: ProjectNameOrUntrackedProps) {
  const projectsQuery = useProjects(organisationId, { status: "all" });
  const project = projectId
    ? projectsQuery.data?.find((candidate) => candidate.id === projectId)
    : undefined;

  if (!project) {
    return <span className="text-slate-900/50">Untracked</span>;
  }

  return <span className="text-slate-900">{project.name}</span>;
}
