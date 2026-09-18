import type { Project } from "@/types/project";

/** Same fallback `ProjectBadgeOrUntracked` renders, for export formats
 * where a colour badge isn't possible. */
export function projectNameOrUntracked(
  projects: Pick<Project, "id" | "name">[],
  projectId: string | null,
): string {
  if (!projectId) {
    return "Untracked";
  }
  return projects.find((project) => project.id === projectId)?.name ?? "Untracked";
}
