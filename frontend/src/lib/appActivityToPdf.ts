import { appActivityRows } from "@/lib/appActivityRows";
import { toPdfBlob } from "@/lib/toPdfBlob";
import type { AppActivityDay } from "@/types/appActivity";
import type { Project } from "@/types/project";

export function appActivityToPdf(
  title: string,
  day: AppActivityDay,
  projects: Pick<Project, "id" | "name">[],
  projectsEnabled = true,
): Blob {
  const { header, rows } = appActivityRows(day, projects, projectsEnabled);
  return toPdfBlob(title, header, rows);
}
