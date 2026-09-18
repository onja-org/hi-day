import { afterEach, describe, expect, it, vi } from "vitest";
import { createProject } from "@/lib/createProject";

describe("createProject", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the created project on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          project: { id: "p-1", name: "Website" },
          message: "Project created",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createProject("org-1", { name: "Website" });

    expect(result).toEqual({
      ok: true,
      project: { id: "p-1", name: "Website" },
      message: "Project created",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Website" }),
      }),
    );
  });

  it("surfaces a conflict error for a duplicate name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "A project with this name already exists in this organisation.",
          }),
      }),
    );

    const result = await createProject("org-1", { name: "Website" });

    expect(result).toEqual({
      ok: false,
      message: "A project with this name already exists in this organisation.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await createProject("org-1", { name: "Website" });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
