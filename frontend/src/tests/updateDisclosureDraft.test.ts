import { afterEach, describe, expect, it, vi } from "vitest";
import { updateDisclosureDraft } from "@/lib/updateDisclosureDraft";

const draft = {
  id: "dv-1",
  disclosureRegion: "FR",
  text: "Updated text",
  status: "draft",
  version: null,
  publishedAt: null,
  publishedByMembershipId: null,
};

describe("updateDisclosureDraft", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PATCHes the draft text and returns ok with the updated draft", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ draft, message: "Disclosure draft updated" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateDisclosureDraft(100000, "FR", "Updated text");

    expect(result).toEqual({
      ok: true,
      draft,
      message: "Disclosure draft updated",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/100000/disclosure-versions/draft?region=FR",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Updated text" }),
      },
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "text must be a string" }),
      }),
    );

    const result = await updateDisclosureDraft(100000, null, "");

    expect(result).toEqual({ ok: false, message: "text must be a string" });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await updateDisclosureDraft(100000, null, "text");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
