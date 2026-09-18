import { afterEach, describe, expect, it, vi } from "vitest";
import { updateProject } from "@/lib/updateProject";

describe("updateProject", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the updated project on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            project: { id: "p-1", client: "Acme Inc" },
            message: "Project updated",
          }),
      }),
    );

    const result = await updateProject("org-1", "p-1", { client: "Acme Inc" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.client).toBe("Acme Inc");
    }
  });

  it("surfaces the archived-project conflict error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "This project is archived — unarchive it first to make changes.",
          }),
      }),
    );

    const result = await updateProject("org-1", "p-1", { name: "New" });

    expect(result).toEqual({
      ok: false,
      message: "This project is archived — unarchive it first to make changes.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await updateProject("org-1", "p-1", { name: "New" });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
