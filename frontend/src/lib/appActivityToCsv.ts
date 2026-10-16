import { appActivityRows } from "@/lib/appActivityRows";
import { toCsvString } from "@/lib/toCsvString";
import type { AppActivityDay } from "@/types/appActivity";
import type { Project } from "@/types/project";

export function appActivityToCsv(
  day: AppActivityDay,
  projects: Pick<Project, "id" | "name">[],
  projectsEnabled = true,
): string {
  const { header, rows } = appActivityRows(day, projects, projectsEnabled);
  return toCsvString(header, rows);
}
