import { describe, expect, it } from "vitest";
import { differsOnlyByPage } from "@/lib/differsOnlyByPage";

const KEY = ["screenshots", "activity", "org-1", "self", "2026-09-08", "all"];

describe("differsOnlyByPage", () => {
  it("is true when only the page number moved", () => {
    expect(differsOnlyByPage([...KEY, 1], [...KEY, 2])).toBe(true);
  });

  it("is false when the day changed", () => {
    const otherDay = ["screenshots", "activity", "org-1", "self", "2026-09-09", "all"];

    expect(differsOnlyByPage([...KEY, 1], [...otherDay, 1])).toBe(false);
  });

  it("is false when the member changed", () => {
    const otherMember = ["screenshots", "activity", "org-1", "member-2", "2026-09-08", "all"];

    expect(differsOnlyByPage([...KEY, 2], [...otherMember, 2])).toBe(false);
  });

  it("tells a missing filter apart from one set to the same text", () => {
    expect(differsOnlyByPage(["a", null, 1], ["a", "null", 1])).toBe(false);
  });
});
