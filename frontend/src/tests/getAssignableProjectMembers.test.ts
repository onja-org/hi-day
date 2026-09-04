import { afterEach, describe, expect, it, vi } from "vitest";
import { getAssignableProjectMembers } from "@/lib/getAssignableProjectMembers";

describe("getAssignableProjectMembers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the assignable member list on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([{ id: "m-1", userId: "u-1", email: "a@b.test", name: "A B" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAssignableProjectMembers("org-1", "p-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.members).toHaveLength(1);
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/assignable-members",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "You do not have the required role for this project.",
          }),
      }),
    );

    const result = await getAssignableProjectMembers("org-1", "p-1");

    expect(result).toEqual({
      ok: false,
      message: "You do not have the required role for this project.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getAssignableProjectMembers("org-1", "p-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
