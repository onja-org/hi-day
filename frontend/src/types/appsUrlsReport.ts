/** One app or website's time in one project on one day — what the Apps & URLs report is built from. */
export type AppsUrlsItem = {
  /** The day, "2026-10-05". */
  dateKey: string;
  projectId: string | null;
  projectName: string;
  /** App name, or the site's host. */
  label: string;
  kind: "app" | "site";
  seconds: number;
};

export type AppsUrlsGrouping = "date" | "project" | "app";
