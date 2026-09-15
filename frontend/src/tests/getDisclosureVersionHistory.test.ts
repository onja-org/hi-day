import { afterEach, describe, expect, it, vi } from "vitest";
import { getDisclosureVersionHistory } from "@/lib/getDisclosureVersionHistory";

const versions = [
  {
    id: "dv-2",
    disclosureRegion: "FR",
    version: 2,
    publishedAt: "2026-09-15T00:00:00.000Z",
    publishedByMembershipId: "membership-1",
  },
  {
    id: "dv-1",
    disclosureRegion: "FR",
    version: 1,
    publishedAt: "2026-01-01T00:00:00.000Z",
    publishedByMembershipId: "membership-1",
  },
];

describe("getDisclosureVersionHistory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the published version list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(versions) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getDisclosureVersionHistory(100000, "FR");

    expect(result).toEqual({ ok: true, versions });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/100000/disclosure-versions?region=FR",
      { credentials: "include" },
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

    const result = await getDisclosureVersionHistory(100000, null);

    expect(result).toEqual({
      ok: false,
      message: "You do not have the required role for this organisation.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getDisclosureVersionHistory(100000, null);

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
