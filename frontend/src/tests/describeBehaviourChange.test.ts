import { describe, expect, it } from "vitest";
import { describeBehaviourChange } from "@/lib/describeBehaviourChange";
import type { BehaviourChange } from "@/types/highlights";

const week = { periodDays: 7, periods: 3, ownPage: false, sameDays: false };

const activityDrop: BehaviourChange = {
  metric: "activity",
  direction: "lower",
  changePercent: 20,
  current: 40,
  average: 50,
};

describe("describeBehaviourChange", () => {
  it("describes a drop in core work against the previous weeks", () => {
    const change: BehaviourChange = {
      metric: "core_work",
      direction: "lower",
      changePercent: 19,
      current: 0.405,
      average: 0.5,
    };

    expect(describeBehaviourChange(change, week)).toEqual({
      label: "Core work",
      change: "19% lower",
      comparison: "Compared with their own average over the previous 3 weeks.",
      rows: [
        { label: "This period", span: { start: 0, end: 0.405 }, display: "41%", highlight: true, tone: "drop" },
        { label: "Their average", span: { start: 0, end: 0.5 }, display: "50%" },
      ],
      max: 0.5,
    });
  });

  it("says 'your own' on your own page", () => {
    const change: BehaviourChange = { ...activityDrop, direction: "higher", changePercent: 25, current: 60, average: 48 };

    const note = describeBehaviourChange(change, { ...week, ownPage: true });

    expect(note.change).toBe("25% higher");
    expect(note.comparison).toBe("Compared with your own average over the previous 3 weeks.");
    expect(note.rows.map((row) => [row.label, row.display])).toEqual([
      ["This period", "60%"],
      ["Your average", "48%"],
    ]);
    expect(note.max).toBe(60);
    expect(note.rows[0].tone).toBe("rise");
  });

  it("says when only the same days of each earlier period were compared", () => {
    expect(describeBehaviourChange(activityDrop, { ...week, sameDays: true }).comparison).toBe(
      "Compared with their own average on the same days of the previous 3 weeks.",
    );
  });

  it("keeps one decimal under 10%, so a real move doesn't read as no change", () => {
    const change: BehaviourChange = {
      metric: "core_work",
      direction: "lower",
      changePercent: 19,
      current: 0.028125,
      average: 0.0346,
    };

    expect(describeBehaviourChange(change, week).rows.map((row) => row.display)).toEqual(["2.8%", "3.5%"]);
  });

  it("shows focus time as hours and minutes", () => {
    const change: BehaviourChange = {
      metric: "focus_time",
      direction: "lower",
      changePercent: 40,
      current: 3 * 3600,
      average: 5 * 3600,
    };

    expect(describeBehaviourChange(change, week).rows.map((row) => row.display)).toEqual(["3:00", "5:00"]);
  });

  it("names the comparison by the length of the period", () => {
    expect(describeBehaviourChange(activityDrop, { ...week, periodDays: 10 }).comparison).toBe(
      "Compared with their own average over the previous 3 periods of 10 days.",
    );
  });
});
