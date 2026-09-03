import { afterEach, describe, expect, it, vi } from "vitest";
import { archiveProject } from "@/lib/archiveProject";

describe("archiveProject", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the archived project on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "p-1", status: "archived" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await archiveProject("org-1", "p-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.status).toBe("archived");
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/organisations/org-1/projects/p-1/archive",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Project not found." }),
      }),
    );

    const result = await archiveProject("org-1", "p-1");

    expect(result).toEqual({ ok: false, message: "Project not found." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await archiveProject("org-1", "p-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
