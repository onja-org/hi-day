import type { DateRangePreset } from "./dateRange";
import type { SendReportInput } from "./sendReport";

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

/** When and to whom a saved report is meant to be emailed. */
export type ReportSchedule = Omit<SendReportInput, "subject"> & {
  /** The period the delivered report covers, resolved when it's sent. */
  dateRange: DateRangePreset;
  frequency: ScheduleFrequency;
  /** Hour of day to deliver, 0–23. */
  hour: number;
  /** Days to deliver on, 0 = Sunday … 6 = Saturday. */
  days: number[];
};

export type ScheduleReportInput = ReportSchedule & { name: string };
