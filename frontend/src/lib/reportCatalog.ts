import type { Report, ReportSection } from "@/types/report";

/** Display order of the "All reports" page's sections. */
export const REPORT_SECTIONS: ReportSection[] = [
  { id: "popular", label: "Popular reports" },
  { id: "general", label: "General" },
  { id: "payment", label: "Payment" },
  { id: "budgets", label: "Budgets and limits" },
  { id: "timeOff", label: "Time off" },
  { id: "schedule", label: "Schedule" },
];

export const REPORTS: Report[] = [
  {
    id: "time-and-activity",
    title: "Time & activity",
    description:
      "See team members' time worked, activity levels, and amounts earned per project/work order",
    section: "popular",
    badge: "New",
  },
  {
    id: "amounts-owed",
    title: "Amounts owed",
    description: "See how much the hourly paid team members are currently owed",
    section: "popular",
  },
  {
    id: "daily-totals",
    title: "Daily totals",
    description:
      "See team members' time worked, activity levels, and amount earned per days",
    section: "popular",
  },
  {
    id: "time-and-activity-legacy",
    title: "Time & activity (Legacy)",
    description:
      "See team members' time worked, activity levels, and amounts earned per project/work order",
    section: "general",
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
  {
    id: "timesheet-approvals",
    title: "Timesheet approvals",
    description: "See team member's timesheets and their status",
    section: "general",
  },
  {
    id: "work-breaks",
    title: "Work breaks",
    description: "See how many work breaks team members are taking",
    section: "general",
  },
  {
    id: "payments",
    title: "Payments",
    description: "See how much team members were paid over a given period",
    section: "payment",
  },
  {
    id: "weekly-limits",
    title: "Weekly limits",
    description: "See team members' weekly limits usage",
    section: "budgets",
  },
  {
    id: "daily-limits",
    title: "Daily limits",
    description: "See team members' daily limits usage",
    section: "budgets",
  },
  {
    id: "time-off-balances",
    title: "Time off balances",
    description:
      "See your team's time off balances across the organization's time off policies",
    section: "timeOff",
  },
  {
    id: "time-off-transactions",
    title: "Time off transactions",
    description:
      "See your team's time off transactions across the organization's time off policies",
    section: "timeOff",
  },
  {
    id: "shift-attendance",
    title: "Shift attendance",
    description:
      "See team members' completed, late, abandoned, and missed shifts",
    section: "schedule",
  },
  {
    id: "job-attendance",
    title: "Job attendance",
    description: "See team members' completed, late, and missed jobs",
    section: "schedule",
  },
];
