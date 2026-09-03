import { afterEach, describe, expect, it, vi } from "vitest";
import { getOrganisationTeams } from "@/lib/getOrganisationTeams";

describe("getOrganisationTeams", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the team list on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: "team-1", name: "General" }]),
      }),
    );

    const result = await getOrganisationTeams("org-1");

    expect(result).toEqual({
      ok: true,
      teams: [{ id: "team-1", name: "General" }],
    });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Forbidden." }),
      }),
    );

    const result = await getOrganisationTeams("org-1");

    expect(result).toEqual({ ok: false, message: "Forbidden." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getOrganisationTeams("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
