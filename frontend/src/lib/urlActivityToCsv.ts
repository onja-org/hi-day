import { toCsvString } from "@/lib/toCsvString";
import { urlActivityRows } from "@/lib/urlActivityRows";
import type { UrlActivityDay } from "@/types/urlSession";
import type { Project } from "@/types/project";

export function urlActivityToCsv(
  day: UrlActivityDay,
  projects: Pick<Project, "id" | "name">[],
  projectsEnabled = true,
): string {
  const { header, rows } = urlActivityRows(day, projects, projectsEnabled);
  return toCsvString(header, rows);
}
