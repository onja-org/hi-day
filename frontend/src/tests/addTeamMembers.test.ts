import { afterEach, describe, expect, it, vi } from "vitest";
import { addTeamMembers } from "@/lib/addTeamMembers";

describe("addTeamMembers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports every input as succeeded when all requests succeed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const result = await addTeamMembers("org-1", "team-1", [
      { membershipId: "m-1", isManager: false },
      { membershipId: "m-2", isManager: true },
    ]);

    expect(result).toEqual({
      succeededMembershipIds: ["m-1", "m-2"],
      failed: [],
    });
  });

  it("separates succeeded from failed members instead of failing the whole batch", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { membershipId: string };
      if (body.membershipId === "m-2") {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: "Membership not found." }),
        });
      }
      return Promise.resolve({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await addTeamMembers("org-1", "team-1", [
      { membershipId: "m-1" },
      { membershipId: "m-2" },
      { membershipId: "m-3" },
    ]);

    expect(result.succeededMembershipIds).toEqual(["m-1", "m-3"]);
    expect(result.failed).toEqual([
      { membershipId: "m-2", message: "Membership not found." },
    ]);
  });
});
