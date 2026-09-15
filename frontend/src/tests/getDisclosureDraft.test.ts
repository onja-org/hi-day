import { afterEach, describe, expect, it, vi } from "vitest";
import { getDisclosureDraft } from "@/lib/getDisclosureDraft";

const draft = {
  id: "dv-1",
  disclosureRegion: null,
  text: "We track...",
  status: "draft",
  version: null,
  publishedAt: null,
  publishedByMembershipId: null,
};

describe("getDisclosureDraft", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the draft on success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(draft) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getDisclosureDraft(100000, null);

    expect(result).toEqual({ ok: true, draft });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/100000/disclosure-versions/draft",
      { credentials: "include" },
    );
  });

  it("includes an encoded region query param when a region is given", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(draft) });
    vi.stubGlobal("fetch", fetchMock);

    await getDisclosureDraft(100000, "FR");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/100000/disclosure-versions/draft?region=FR",
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

    const result = await getDisclosureDraft(100000, null);

    expect(result).toEqual({
      ok: false,
      message: "You do not have the required role for this organisation.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getDisclosureDraft(100000, null);

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
