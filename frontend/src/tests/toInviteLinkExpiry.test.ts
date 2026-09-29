import { describe, expect, it } from "vitest";
import { fromInviteLinkExpiry, toInviteLinkExpiry } from "@/lib/toInviteLinkExpiry";

describe("toInviteLinkExpiry", () => {
  it("means 'never' for a blank date", () => {
    expect(toInviteLinkExpiry("")).toBeNull();
  });

  it("expires at the very end of the chosen local day", () => {
    const expiry = new Date(toInviteLinkExpiry("2026-10-04")!);
    expect([expiry.getFullYear(), expiry.getMonth(), expiry.getDate()]).toEqual([2026, 9, 4]);
    expect([expiry.getHours(), expiry.getMinutes()]).toEqual([23, 59]);
  });

  it("round-trips through fromInviteLinkExpiry", () => {
    expect(fromInviteLinkExpiry(toInviteLinkExpiry("2026-10-04"))).toBe("2026-10-04");
    expect(fromInviteLinkExpiry(null)).toBe("");
  });
});
