import { formatElapsed } from "@/lib/formatElapsed";
import { projectNameOrUntracked } from "@/lib/projectNameOrUntracked";
import { unknownWebsiteLabel } from "@/lib/unknownWebsiteLabel";
import type { UrlActivityDay } from "@/types/urlSession";
import type { Project } from "@/types/project";

function formatHour(hourStart: string): string {
  return new Date(hourStart).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

/** Shared table shape both `urlActivityToCsv` and `urlActivityToPdf` render from. */
export function urlActivityRows(
  day: UrlActivityDay,
  projects: Pick<Project, "id" | "name">[],
  /** Off, there is no Project column: "No project" on every row would only be noise. */
  projectsEnabled = true,
): { header: string[]; rows: string[][] } {
  const header = ["Hour", ...(projectsEnabled ? ["Project"] : []), "URL", "Title", "Time spent", "Sessions"];
  const rows = day.buckets.flatMap((bucket) =>
    bucket.pages.map((page) => [
      formatHour(bucket.hourStart),
      ...(projectsEnabled ? [projectNameOrUntracked(projects, page.projectId)] : []),
      page.urlUnknown ? unknownWebsiteLabel(page.browser) : page.url,
      page.title ?? "",
      formatElapsed(page.activeMs),
      String(page.sessionCount),
    ]),
  );
  return { header, rows };
}
