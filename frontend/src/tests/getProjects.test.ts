import { afterEach, describe, expect, it, vi } from "vitest";
import { getProjects } from "@/lib/getProjects";

describe("getProjects", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the project list on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "p-1", name: "Website" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getProjects("org-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projects).toHaveLength(1);
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("includes status and client filters as query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getProjects("org-1", { status: "archived", client: "Acme Inc" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects?status=archived&client=Acme+Inc",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Not allowed." }),
      }),
    );

    const result = await getProjects("org-1");

    expect(result).toEqual({ ok: false, message: "Not allowed." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getProjects("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
