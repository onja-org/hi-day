import { afterEach, describe, expect, it, vi } from "vitest";
import { addProjectMember } from "@/lib/addProjectMember";

describe("addProjectMember", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the assigned member on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          member: { membershipId: "m-1", effectiveRate: "75.00" },
          message: "Project member added",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await addProjectMember("org-1", "p-1", {
      membershipId: "m-1",
      rate: "75.00",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.member.effectiveRate).toBe("75.00");
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/members",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ membershipId: "m-1", rate: "75.00" }),
      }),
    );
  });

  it("surfaces a conflict error when the member is already assigned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "This member is already on the project." }),
      }),
    );

    const result = await addProjectMember("org-1", "p-1", {
      membershipId: "m-1",
    });

    expect(result).toEqual({
      ok: false,
      message: "This member is already on the project.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await addProjectMember("org-1", "p-1", {
      membershipId: "m-1",
    });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
