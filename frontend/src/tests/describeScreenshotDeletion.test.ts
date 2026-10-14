import { describe, expect, it } from "vitest";
import { describeScreenshotDeletion } from "@/lib/describeScreenshotDeletion";

const NAMES: Record<string, string> = { "p-1": "Development", "p-2": "Design" };
const lookup = (id: string) => NAMES[id];

function at(time: string, projectId: string | null) {
  return { capturedAt: `2026-10-14T${time}:00.000`, projectId };
}

describe("describeScreenshotDeletion", () => {
  it("names the single time and project for one screenshot", () => {
    expect(describeScreenshotDeletion([at("09:10", "p-1")], lookup)).toContain(
      "1 screenshot captured at 09:10 AM, on Development.\n\nThe image is removed permanently",
    );
  });

  it("spans the earliest and latest capture, whatever order they arrive in", () => {
    const message = describeScreenshotDeletion(
      [at("09:40", "p-1"), at("09:00", "p-1")],
      lookup,
    );
    expect(message).toContain(
      "2 screenshots captured between 09:00 AM and 09:40 AM, on Development.",
    );
  });

  it("lists every distinct project once, calling a missing one Untracked", () => {
    const message = describeScreenshotDeletion(
      [at("09:00", "p-1"), at("09:10", "p-2"), at("09:20", null), at("09:30", "p-1")],
      lookup,
    );
    expect(message).toContain(
      "across Development, Design and untracked time.",
    );
  });

  it("does not claim a project for a screenshot no timer covered", () => {
    expect(describeScreenshotDeletion([at("09:10", null)], lookup)).toContain(
      "1 screenshot captured at 09:10 AM, with no project.",
    );
  });

  it("says the time stays on the timesheet, since only the image goes", () => {
    expect(describeScreenshotDeletion([at("09:00", "p-1")], lookup)).toContain(
      "The tracked time stays on the timesheet.",
    );
  });
});
