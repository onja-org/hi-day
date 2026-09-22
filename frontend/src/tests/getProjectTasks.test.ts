import { afterEach, describe, expect, it, vi } from "vitest";
import { getProjectTasks } from "@/lib/getProjectTasks";

describe("getProjectTasks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the project tasks list on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          project: { id: "p-1", name: "Website", colour: "blue", status: "active" },
          tasks: [],
          canManage: true,
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getProjectTasks("org-1", "p-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.canManage).toBe(true);
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/tasks",
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

    const result = await getProjectTasks("org-1", "p-1");

    expect(result).toEqual({
      ok: false,
      message: "You do not have the required role for this project.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getProjectTasks("org-1", "p-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
