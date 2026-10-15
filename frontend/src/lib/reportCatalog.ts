import type { Report, ReportSection } from "@/types/report";

/** Display order of the "All reports" page's sections. */
export const REPORT_SECTIONS: ReportSection[] = [
  { id: "popular", label: "Popular reports" },
  { id: "general", label: "General" },
];

export const REPORTS: Report[] = [
  {
    id: "time-and-activity",
    title: "Time & activity",
    description:
      "See team members' time worked, activity levels, and amounts earned per project/work order",
    descriptionWithoutProjects:
      "See team members' time worked, activity levels, and amounts earned",
    section: "popular",
    badge: "New",
  },
  {
    id: "daily-totals",
    title: "Daily totals",
    description:
      "See team members' time worked, activity levels, and amount earned per days",
    section: "popular",
    needsProjects: true,
  },
  {
    id: "work-sessions",
    title: "Work sessions",
    description: "See the start and stop times for team members",
    section: "general",
  },
  {
    id: "apps-and-urls",
    title: "Apps & URLs",
    description: "See team members' apps used and URLs visited while working",
    section: "general",
  },
  {
    id: "manual-time-edits",
    title: "Manual time edits",
    description:
      "See team members' time worked, and reason for each manual time entry",
    section: "general",
  },
];

/** The catalog as an Organisation sees it: Project-only reports are left out when Projects are off, and descriptions stop mentioning them. */
export function reportsFor(projectsEnabled: boolean): Report[] {
  if (projectsEnabled) return REPORTS;
  return REPORTS.filter((report) => !report.needsProjects).map((report) => ({
    ...report,
    description: report.descriptionWithoutProjects ?? report.description,
  }));
}
