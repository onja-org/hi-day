import { afterEach, describe, expect, it, vi } from "vitest";
import { cutTimeEntryRange } from "@/lib/cutTimeEntryRange";

describe("cutTimeEntryRange", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const input = {
    from: "2026-01-05T12:00:00.000Z",
    to: "2026-01-05T13:00:00.000Z",
    mode: "remove" as const,
    reason: "Lunch",
  };

  it("posts the range, mode and reason to the entry's cut endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ entries: [{ id: "te-1" }], message: "done" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await cutTimeEntryRange("org-1", "te-1", input);

    expect(result).toEqual({ ok: true, entries: [{ id: "te-1" }], message: "done" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/backend/organisations/org-1/time-entries/te-1/cut");
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it("leaves the reason out when none is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ entries: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await cutTimeEntryRange("org-1", "te-1", { ...input, reason: undefined });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty("reason");
  });

  it("returns the server's message when refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Give a reason for this change." }),
      }),
    );

    const result = await cutTimeEntryRange("org-1", "te-1", input);

    expect(result).toEqual({ ok: false, message: "Give a reason for this change." });
  });

  it("returns a generic message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await cutTimeEntryRange("org-1", "te-1", input);

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
