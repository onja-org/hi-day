import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteProject } from "@/lib/deleteProject";

describe("deleteProject", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Project deleted" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteProject("org-1", "p-1");

    expect(result).toEqual({ ok: true, message: "Project deleted" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "This project has time logged against it." }),
      }),
    );

    const result = await deleteProject("org-1", "p-1");

    expect(result).toEqual({ ok: false, message: "This project has time logged against it." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await deleteProject("org-1", "p-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
