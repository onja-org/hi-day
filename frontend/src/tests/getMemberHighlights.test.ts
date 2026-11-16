import { afterEach, describe, expect, it, vi } from "vitest";
import { getMemberHighlights } from "@/lib/getMemberHighlights";

describe("getMemberHighlights", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for the member and range, and returns the report", async () => {
    const report = { membershipId: "membership-2" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(report) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMemberHighlights("org-1", {
      membershipId: "membership-2",
      from: "2026-11-02",
      to: "2026-11-08",
    });

    expect(result).toEqual({ ok: true, message: "", report });
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/organisations/org-1/insights/highlights?from=2026-11-02&to=2026-11-08&membershipId=membership-2",
    );
  });

  it("leaves the member out for your own highlights", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);

    await getMemberHighlights("org-1", { from: "2026-11-02", to: "2026-11-08" });

    expect(fetchMock.mock.calls[0][0]).not.toContain("membershipId");
  });

  it("returns the server's message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: ["You cannot view this member's insights."] }),
      }),
    );

    const result = await getMemberHighlights("org-1", { from: "2026-11-02", to: "2026-11-08" });

    expect(result).toEqual({ ok: false, message: "You cannot view this member's insights." });
  });

  it("returns a generic message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await getMemberHighlights("org-1", { from: "2026-11-02", to: "2026-11-08" });

    expect(result).toEqual({ ok: false, message: "Something went wrong. Please try again." });
  });
});
