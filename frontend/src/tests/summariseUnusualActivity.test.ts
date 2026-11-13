import { describe, expect, it } from "vitest";
import { summariseUnusualActivity } from "@/lib/summariseUnusualActivity";
import type { UnusualInstance, UnusualSeverity } from "@/types/unusualActivity";

const instance = (severity: UnusualSeverity): UnusualInstance => ({
  date: "2026-11-10",
  start: "2026-11-10T14:00:00.000Z",
  end: "2026-11-10T15:00:00.000Z",
  durationSeconds: 3600,
  severity,
  rules: ["high_activity"],
  reasons: ["Activity stayed at 100% for 1 h"],
});

const report = {
  instances: [instance("highly_unusual"), instance("highly_unusual"), instance("slightly_unusual")],
  affectedSeconds: { highly_unusual: 7200, unusual: 0, slightly_unusual: 1800 },
  previousPeriod: {
    from: "2026-09-03",
    to: "2026-11-01",
    affectedSeconds: { highly_unusual: 600, unusual: 1200, slightly_unusual: 3600 },
  },
};

describe("summariseUnusualActivity", () => {
  it("adds up every severity when all are selected", () => {
    const summary = summariseUnusualActivity(report, ["highly_unusual", "unusual", "slightly_unusual"]);

    expect(summary.counts).toEqual({ highly_unusual: 2, unusual: 0, slightly_unusual: 1 });
    expect(summary.instances).toHaveLength(3);
    expect(summary.affectedSeconds).toBe(9000);
    expect(summary.previousAffectedSeconds).toBe(5400);
  });

  it("filters the list and both time totals, but keeps every count", () => {
    const summary = summariseUnusualActivity(report, ["highly_unusual"]);

    expect(summary.counts).toEqual({ highly_unusual: 2, unusual: 0, slightly_unusual: 1 });
    expect(summary.instances.map((item) => item.severity)).toEqual(["highly_unusual", "highly_unusual"]);
    expect(summary.affectedSeconds).toBe(7200);
    expect(summary.previousAffectedSeconds).toBe(600);
  });

  it("shows nothing with no severity selected", () => {
    const summary = summariseUnusualActivity(report, []);

    expect(summary.instances).toEqual([]);
    expect(summary.affectedSeconds).toBe(0);
  });
});
