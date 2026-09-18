import { afterEach, describe, expect, it, vi } from "vitest";
import { unarchiveProject } from "@/lib/unarchiveProject";

describe("unarchiveProject", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the reactivated project on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          project: { id: "p-1", status: "active" },
          message: "Project unarchived",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await unarchiveProject("org-1", "p-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.status).toBe("active");
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/unarchive",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await unarchiveProject("org-1", "p-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
