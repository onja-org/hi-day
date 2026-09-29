import { describe, expect, it } from "vitest";
import { formatMembershipRole } from "@/lib/formatMembershipRole";

describe("formatMembershipRole", () => {
  it("gives each role its display label", () => {
    expect(formatMembershipRole("admin")).toBe("Admin");
    expect(formatMembershipRole("manager")).toBe("Manager");
    expect(formatMembershipRole("member")).toBe("Member");
    expect(formatMembershipRole("finance")).toBe("Finance");
  });
});
