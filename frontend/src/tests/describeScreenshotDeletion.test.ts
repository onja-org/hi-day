import { describe, expect, it } from "vitest";
import { describeScreenshotDeletion } from "@/lib/describeScreenshotDeletion";

const NAMES: Record<string, string> = { "p-1": "Development", "p-2": "Design" };
const lookup = (id: string) => NAMES[id];

function at(time: string, projectId: string | null) {
  return { capturedAt: `2026-10-14T${time}:00.000`, projectId };
}

describe("describeScreenshotDeletion", () => {
  it("names the time and project, and says the tracked time survives", () => {
    expect(describeScreenshotDeletion([at("09:10", "p-1")], lookup)).toBe(
      "1 screenshot captured at 09:10 AM, on Development.\n\n" +
        "The image is removed permanently and cannot be undone. The tracked time stays on the timesheet.",
    );
  });

  it("spans the earliest and latest capture, whatever order they arrive in", () => {
    expect(
      describeScreenshotDeletion([at("09:40", "p-1"), at("09:00", "p-1")], lookup),
    ).toContain("2 screenshots captured between 09:00 AM and 09:40 AM, on Development.");
  });

  it("lists every distinct project once, naming uncovered time as untracked", () => {
    expect(
      describeScreenshotDeletion(
        [at("09:00", "p-1"), at("09:10", "p-2"), at("09:20", null), at("09:30", "p-1")],
        lookup,
      ),
    ).toContain("across Development, Design and untracked time.");
  });

  it("does not claim a project for a screenshot no timer covered", () => {
    expect(describeScreenshotDeletion([at("09:10", null)], lookup)).toContain(
      "1 screenshot captured at 09:10 AM, with no project.",
    );
  });
});
