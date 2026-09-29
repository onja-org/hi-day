import { describe, expect, it } from "vitest";
import { formatShortDate } from "@/lib/formatShortDate";

describe("formatShortDate", () => {
  it("formats weekday, month, day and year", () => {
    expect(formatShortDate(new Date(2024, 1, 19), "en-US")).toBe("Mon, Feb 19, 2024");
  });

  it("accepts an ISO string", () => {
    expect(formatShortDate("2026-09-29T12:00:00", "en-US")).toBe("Tue, Sep 29, 2026");
  });
});
