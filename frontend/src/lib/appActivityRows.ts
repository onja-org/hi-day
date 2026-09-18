import { formatElapsed } from "@/lib/formatElapsed";
import { projectNameOrUntracked } from "@/lib/projectNameOrUntracked";
import type { AppActivityDay } from "@/types/appActivity";
import type { Project } from "@/types/project";

function formatHour(hourStart: string): string {
  return new Date(hourStart).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

/** Shared table shape both `appActivityToCsv` and `appActivityToPdf` render from. */
export function appActivityRows(
  day: AppActivityDay,
  projects: Pick<Project, "id" | "name">[],
): { header: string[]; rows: string[][] } {
  const header = ["Hour", "Project", "App", "Time spent", "Sessions"];
  const rows = day.buckets.flatMap((bucket) =>
    bucket.items.map((item) => [
      formatHour(bucket.hourStart),
      projectNameOrUntracked(projects, item.projectId),
      item.appName,
      formatElapsed(item.secondsSpent * 1000),
      String(item.sessionCount),
    ]),
  );
  return { header, rows };
}
