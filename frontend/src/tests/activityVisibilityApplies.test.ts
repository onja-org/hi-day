import { describe, expect, it } from "vitest";
import { activityVisibilityApplies } from "@/lib/activityVisibilityApplies";

describe("activityVisibilityApplies", () => {
  it("applies to a plain member", () => {
    expect(
      activityVisibilityApplies({ role: "member", isManager: false }),
    ).toBe(true);
  });

  it("does not apply to an admin — they always see their own activity", () => {
    expect(activityVisibilityApplies({ role: "admin", isManager: false })).toBe(
      false,
    );
  });

  it("does not apply to someone managing this team, for the same reason", () => {
    expect(activityVisibilityApplies({ role: "member", isManager: true })).toBe(
      false,
    );
  });

  it("does not apply to an admin who also manages the team", () => {
    expect(activityVisibilityApplies({ role: "admin", isManager: true })).toBe(
      false,
    );
  });

  it("applies to the manager role when they run no team here", () => {
    // The role alone doesn't exempt them — only managing a team does.
    expect(
      activityVisibilityApplies({ role: "manager", isManager: false }),
    ).toBe(true);
  });

  it("applies to finance", () => {
    expect(
      activityVisibilityApplies({ role: "finance", isManager: false }),
    ).toBe(true);
  });
});
