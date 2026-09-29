import { describe, expect, it } from "vitest";
import { formatInviteLinkUsage } from "@/lib/formatInviteLinkUsage";

describe("formatInviteLinkUsage", () => {
  it("shows joins against the cap", () => {
    expect(formatInviteLinkUsage(3, 10)).toBe("3 / 10");
  });

  it("shows an unlimited link with ∞", () => {
    expect(formatInviteLinkUsage(0, null)).toBe("0 / ∞");
  });
});
