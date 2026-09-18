import { toCsvString } from "@/lib/toCsvString";
import { urlActivityRows } from "@/lib/urlActivityRows";
import type { UrlActivityDay } from "@/types/urlSession";
import type { Project } from "@/types/project";

export function urlActivityToCsv(
  day: UrlActivityDay,
  projects: Pick<Project, "id" | "name">[],
): string {
  const { header, rows } = urlActivityRows(day, projects);
  return toCsvString(header, rows);
}
