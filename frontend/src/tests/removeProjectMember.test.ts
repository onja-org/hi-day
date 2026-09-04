import { afterEach, describe, expect, it, vi } from "vitest";
import { removeProjectMember } from "@/lib/removeProjectMember";

describe("removeProjectMember", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await removeProjectMember("org-1", "p-1", "m-1");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/members/m-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "This member is not on the project." }),
      }),
    );

    const result = await removeProjectMember("org-1", "p-1", "m-1");

    expect(result).toEqual({
      ok: false,
      message: "This member is not on the project.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await removeProjectMember("org-1", "p-1", "m-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
