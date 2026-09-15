import { afterEach, describe, expect, it, vi } from "vitest";
import { publishDisclosureVersion } from "@/lib/publishDisclosureVersion";

const published = {
  id: "dv-2",
  disclosureRegion: null,
  text: "We track...",
  status: "published",
  version: 1,
  publishedAt: "2026-09-15T00:00:00.000Z",
  publishedByMembershipId: "membership-1",
};

describe("publishDisclosureVersion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to the publish endpoint and returns ok with the new version", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(published) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishDisclosureVersion(100000, null);

    expect(result).toEqual({ ok: true, version: published });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/100000/disclosure-versions/publish",
      { method: "POST", credentials: "include" },
    );
  });

  it("surfaces a conflict error message when another publish just landed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message:
              "Another publish for this disclosure text just completed — please retry.",
          }),
      }),
    );

    const result = await publishDisclosureVersion(100000, null);

    expect(result).toEqual({
      ok: false,
      message:
        "Another publish for this disclosure text just completed — please retry.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await publishDisclosureVersion(100000, null);

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
