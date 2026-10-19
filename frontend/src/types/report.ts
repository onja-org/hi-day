export type ReportSectionId =
  | "popular"
  | "general"
  | "payment"
  | "budgets"
  | "timeOff"
  | "schedule";

export type Report = {
  id: string;
  title: string;
  description: string;
  section: ReportSectionId;
  /** Small pill after the title, e.g. "New". */
  badge?: string;
  /** The report is a grid of Projects, so it means nothing without them. */
  needsProjects?: boolean;
  /** Replaces `description` when Projects are off and it mentions them. */
  descriptionWithoutProjects?: string;
};

export type ReportSection = {
  id: ReportSectionId;
  label: string;
};
