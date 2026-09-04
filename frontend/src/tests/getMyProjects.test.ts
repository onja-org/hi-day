import { afterEach, describe, expect, it, vi } from "vitest";
import { getMyProjects } from "@/lib/getMyProjects";

describe("getMyProjects", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the project list on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "p-1", name: "Website" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMyProjects("org-1");

    expect(result).toEqual({
      ok: true,
      projects: [{ id: "p-1", name: "Website" }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/my-projects",
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
            message: "You do not have the required role for this organisation.",
          }),
      }),
    );

    const result = await getMyProjects("org-1");

    expect(result).toEqual({
      ok: false,
      message: "You do not have the required role for this organisation.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getMyProjects("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
