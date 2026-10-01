import type { Report } from "@/types/report";

/** Reports whose title or description contains `query`, ignoring case — all of them for a blank query. */
export function filterReports(reports: Report[], query: string): Report[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return reports;
  return reports.filter(
    (report) =>
      report.title.toLowerCase().includes(needle) ||
      report.description.toLowerCase().includes(needle),
  );
}
