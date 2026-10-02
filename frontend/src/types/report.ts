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
};

export type ReportSection = {
  id: ReportSectionId;
  label: string;
};
