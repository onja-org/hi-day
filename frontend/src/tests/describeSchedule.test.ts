import { describe, expect, it } from "vitest";
import { describeSchedule } from "@/lib/describeSchedule";

describe("describeSchedule", () => {
  it("names the frequency, days in week order, and the time", () => {
    expect(
      describeSchedule({
        emails: ["a@b.co"],
        message: "hi",
        fileType: "pdf",
        dateRange: "last_week",
        frequency: "weekly",
        hour: 9,
        days: [3, 1],
      }),
    ).toBe("Weekly on Monday, Wednesday at 9:00 AM");
  });
});
