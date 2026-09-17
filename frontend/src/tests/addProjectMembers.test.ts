import { afterEach, describe, expect, it, vi } from "vitest";
import { addProjectMembers } from "@/lib/addProjectMembers";

describe("addProjectMembers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports every input as succeeded when all requests succeed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ membershipId: "irrelevant" }),
      }),
    );

    const result = await addProjectMembers("org-1", "p-1", [
      { membershipId: "m-1", role: "member" },
      { membershipId: "m-2", role: "manager" },
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
          json: () =>
            Promise.resolve({ message: "This member is already on the project." }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ membershipId: body.membershipId }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await addProjectMembers("org-1", "p-1", [
      { membershipId: "m-1" },
      { membershipId: "m-2" },
      { membershipId: "m-3" },
    ]);

    expect(result.succeededMembershipIds).toEqual(["m-1", "m-3"]);
    expect(result.failed).toEqual([
      { membershipId: "m-2", message: "This member is already on the project." },
    ]);
  });
});
