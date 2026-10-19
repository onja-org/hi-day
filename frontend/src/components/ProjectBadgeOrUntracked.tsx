import { useProjects } from "@/hooks/useProjects";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { ProjectColourBadge } from "./ProjectColourBadge";

type ProjectBadgeOrUntrackedProps = {
  organisationId: string;
  /** null = no covering TimeEntry was found for this row. */
  projectId: string | null;
};

/** Renders a real Project's colour badge + name for an Apps/URLs/
 * Screenshots activity row, or a "No project" label when no TimeEntry
 * covered that instant — the common case, since the desktop agent tracks
 * continuously while a TimeEntry only exists while a timer runs.
 * `status: "all"` (not just active) so a since-archived project still
 * resolves correctly for older activity. */
export function ProjectBadgeOrUntracked({
  organisationId,
  projectId,
}: ProjectBadgeOrUntrackedProps) {
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

  return (
    <span className="flex items-center gap-2">
      <ProjectColourBadge colour={project.colour} />
      {project.name}
    </span>
  );
}
