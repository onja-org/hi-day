import { describe, expect, it } from "vitest";
import { formatScheduleHour } from "@/lib/formatScheduleHour";

describe("formatScheduleHour", () => {
  it("shows midnight and noon as 12", () => {
    expect(formatScheduleHour(0)).toBe("12:00 AM");
    expect(formatScheduleHour(12)).toBe("12:00 PM");
  });

  it("uses AM before noon and PM after", () => {
    expect(formatScheduleHour(9)).toBe("9:00 AM");
    expect(formatScheduleHour(15)).toBe("3:00 PM");
    expect(formatScheduleHour(23)).toBe("11:00 PM");
  });
});
