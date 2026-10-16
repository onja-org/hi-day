import { toPdfBlob } from "@/lib/toPdfBlob";
import { urlActivityRows } from "@/lib/urlActivityRows";
import type { UrlActivityDay } from "@/types/urlSession";
import type { Project } from "@/types/project";

// Matches urlActivityRows' header order: Hour, Project, URL, Title, Time
// spent, Sessions. URL and Title are the two columns that can hold one
// long, unbreakable "word" (a URL has no spaces to wrap at; a page title
// is shown untruncated) — pinned so they don't crowd out the rest of the
// table (see toPdfBlob's own doc comment).
const URL_COLUMN_INDEX = 2;
const TITLE_COLUMN_INDEX = 3;
// With Projects off the Project column is gone and both shift left by one.

export function urlActivityToPdf(
  title: string,
  day: UrlActivityDay,
  projects: Pick<Project, "id" | "name">[],
  projectsEnabled = true,
): Blob {
  const { header, rows } = urlActivityRows(day, projects, projectsEnabled);
  const shift = projectsEnabled ? 0 : 1;
  return toPdfBlob(title, header, rows, {
    [URL_COLUMN_INDEX - shift]: 55,
    [TITLE_COLUMN_INDEX - shift]: 45,
  });
}
