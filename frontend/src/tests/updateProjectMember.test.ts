import { afterEach, describe, expect, it, vi } from "vitest";
import { updateProjectMember } from "@/lib/updateProjectMember";

describe("updateProjectMember", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the updated member on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ membershipId: "m-1", role: "manager" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateProjectMember("org-1", "p-1", "m-1", {
      role: "manager",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.member.role).toBe("manager");
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/organisations/org-1/projects/p-1/members/m-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ role: "manager" }),
      }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "This member is not on the project." }),
      }),
    );

    const result = await updateProjectMember("org-1", "p-1", "m-1", {
      role: "member",
    });

    expect(result).toEqual({
      ok: false,
      message: "This member is not on the project.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await updateProjectMember("org-1", "p-1", "m-1", {
      role: "manager",
    });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
