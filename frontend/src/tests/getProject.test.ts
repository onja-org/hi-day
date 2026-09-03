import { afterEach, describe, expect, it, vi } from "vitest";
import { getProject } from "@/lib/getProject";

describe("getProject", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the project detail on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "p-1", name: "Website", members: [] }),
      }),
    );

    const result = await getProject("org-1", "p-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.name).toBe("Website");
    }
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Project not found." }),
      }),
    );

    const result = await getProject("org-1", "p-1");

    expect(result).toEqual({ ok: false, message: "Project not found." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getProject("org-1", "p-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
