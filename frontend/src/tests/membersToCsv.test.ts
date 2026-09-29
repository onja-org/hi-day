import { describe, expect, it } from "vitest";
import { membersToCsv } from "@/lib/membersToCsv";
import type { ActiveMemberListItem } from "@/types/membership";

function member(overrides: Partial<ActiveMemberListItem> = {}): ActiveMemberListItem {
  return {
    id: "m-1",
    userId: "u-1",
    email: "ada@example.com",
    name: "Ada Lovelace",
    role: "manager",
    teamIds: ["t-1", "t-hidden"],
    status: "active",
    joinedAt: "2026-02-19T10:00:00.000Z",
    disclosureRegion: null,
    projectIds: ["p-1", "p-2"],
    ...overrides,
  };
}

describe("membersToCsv", () => {
  it("writes one row per member with role, counts, visible teams and date", () => {
    const csv = membersToCsv([member()], new Map([["t-1", "Design"]]));
    expect(csv.split("\n")).toEqual([
      "Name,Email,Role,Status,Projects,Teams,Date added",
      "Ada Lovelace,ada@example.com,Manager,Active,2,Design,2026-02-19",
    ]);
  });

  it("leaves the name blank when the member has none", () => {
    const csv = membersToCsv([member({ name: null, teamIds: [] })], new Map());
    expect(csv.split("\n")[1]).toBe(",ada@example.com,Manager,Active,2,,2026-02-19");
  });
});
