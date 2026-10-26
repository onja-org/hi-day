import { describe, expect, it } from "vitest";
import {
  DESKTOP_APP_PROMPT_SNOOZE_MS,
  isDesktopAppPromptSnoozed,
} from "@/lib/desktopAppPromptSnooze";

const NOW = Date.parse("2026-10-26T12:00:00.000Z");

describe("isDesktopAppPromptSnoozed", () => {
  it("isn't snoozed when the prompt was never dismissed", () => {
    expect(isDesktopAppPromptSnoozed(null, NOW)).toBe(false);
  });

  it("is snoozed just after a dismissal", () => {
    expect(isDesktopAppPromptSnoozed(String(NOW - 1000), NOW)).toBe(true);
  });

  it("is still snoozed a moment before the snooze ends", () => {
    expect(
      isDesktopAppPromptSnoozed(String(NOW - DESKTOP_APP_PROMPT_SNOOZE_MS + 1), NOW),
    ).toBe(true);
  });

  it("isn't snoozed once the snooze has run out", () => {
    expect(
      isDesktopAppPromptSnoozed(String(NOW - DESKTOP_APP_PROMPT_SNOOZE_MS), NOW),
    ).toBe(false);
  });

  it("treats an unreadable value as never dismissed", () => {
    expect(isDesktopAppPromptSnoozed("not-a-date", NOW)).toBe(false);
    expect(isDesktopAppPromptSnoozed("", NOW)).toBe(false);
  });
});
