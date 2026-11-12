import { describe, expect, it } from "vitest";
import { buildComparisonRows } from "@/lib/buildComparisonRows";

const plain = {
  toSpan: (value: number) => ({ start: 0, end: value }),
  format: (value: number) => `${value}%`,
};

describe("buildComparisonRows", () => {
  it("lists the member first, then team and organisation averages", () => {
    expect(
      buildComparisonRows({ memberLabel: "You", member: 60, team: 55, organisation: 50, ...plain }),
    ).toEqual([
      { label: "You", span: { start: 0, end: 60 }, display: "60%", highlight: true },
      { label: "Team avg.", span: { start: 0, end: 55 }, display: "55%", highlight: false },
      { label: "Org avg.", span: { start: 0, end: 50 }, display: "50%", highlight: false },
    ]);
  });

  it("leaves the team row out for a member on no team", () => {
    const rows = buildComparisonRows({
      memberLabel: "You",
      member: 60,
      team: undefined,
      organisation: 50,
      ...plain,
    });
    expect(rows.map((row) => row.label)).toEqual(["You", "Org avg."]);
  });

  it("shows a dash and no bar for a missing figure", () => {
    const [, team] = buildComparisonRows({
      memberLabel: "You",
      member: 60,
      team: null,
      organisation: 50,
      ...plain,
    });
    expect(team).toEqual({ label: "Team avg.", span: null, display: "–", highlight: false });
  });
});
