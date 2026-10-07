import { describe, expect, it } from "vitest";
import { timeOfDayOptions } from "@/lib/timeOfDayOptions";

// No trailing Z: these are wall-clock times, read the way the picker reads
// them, so the test does not pass or fail by the runner's timezone.
const NOW = new Date("2026-01-05T14:32");
const TODAY = "2026-01-05";
const YESTERDAY = "2026-01-04";

function optionsFor(date: string, extra = {}) {
  return timeOfDayOptions({ date, now: NOW, ...extra });
}

function valueOf(date: string, value: string, extra = {}) {
  return optionsFor(date, extra).find((option) => option.value === value);
}

describe("timeOfDayOptions", () => {
  it("covers the whole day at the given step", () => {
    const options = optionsFor(TODAY);

    expect(options[0].value).toBe("00:00");
    expect(options.at(-1)?.value).toBe("23:55");
    expect(options).toHaveLength((24 * 60) / 5);
  });

  it("takes a different step", () => {
    const options = timeOfDayOptions({ date: TODAY, now: NOW, stepMinutes: 15 });

    expect(options).toHaveLength((24 * 60) / 15);
    expect(options[1].value).toBe("00:15");
  });

  // The whole point: a later time is unchoosable, not merely corrected.
  it("disables times after now on today", () => {
    expect(valueOf(TODAY, "14:30")?.disabled).toBe(false);
    expect(valueOf(TODAY, "14:35")?.disabled).toBe(true);
    expect(valueOf(TODAY, "23:55")?.disabled).toBe(true);
  });

  it("leaves every time of an earlier day alone", () => {
    expect(optionsFor(YESTERDAY).some((option) => option.disabled)).toBe(false);
  });

  /**
   * Entries are recorded to the minute, so an existing one rarely sits on a
   * step. Dropping its time would silently move the entry as soon as
   * anything else on the form changed.
   */
  it("keeps an off-step time, in order", () => {
    const options = optionsFor(TODAY, { include: "09:37" });
    const index = options.findIndex((option) => option.value === "09:37");

    expect(index).toBeGreaterThan(-1);
    expect(options[index - 1].value).toBe("09:35");
    expect(options[index + 1].value).toBe("09:40");
  });

  it("does not duplicate an included time that is already a step", () => {
    const options = optionsFor(TODAY, { include: "09:35" });

    expect(options.filter((option) => option.value === "09:35")).toHaveLength(1);
  });

  /**
   * An entry already recorded past the cut-off must stay re-savable — the
   * form has to be able to submit its own unchanged value.
   */
  it("keeps an included time choosable even after the cut-off", () => {
    expect(valueOf(TODAY, "20:00", { include: "20:00" })?.disabled).toBe(false);
    expect(valueOf(TODAY, "20:05", { include: "20:00" })?.disabled).toBe(true);
  });

  it("ignores an unreadable included time", () => {
    expect(() => optionsFor(TODAY, { include: "nonsense" })).not.toThrow();
    expect(optionsFor(TODAY, { include: "99:99" })).toHaveLength((24 * 60) / 5);
  });

  it("disables nothing when no date has been chosen", () => {
    expect(optionsFor("").some((option) => option.disabled)).toBe(false);
  });
});
