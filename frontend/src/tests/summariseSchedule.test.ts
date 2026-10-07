import { describe, expect, it } from "vitest";
import { summariseSchedule } from "@/lib/summariseSchedule";
import type { ReportSchedule } from "@/types/reportSchedule";

const schedule: ReportSchedule = {
  emails: ["a@b.co"],
  message: "",
  fileType: "pdf",
  dateRange: "last_7_days",
  frequency: "daily",
  hour: 16,
  days: [1, 2, 3],
};

describe("summariseSchedule", () => {
  it("joins frequency, days and file type", () => {
    expect(summariseSchedule(schedule)).toBe("Daily | Mon, Tue, Wed | PDF");
  });
});
