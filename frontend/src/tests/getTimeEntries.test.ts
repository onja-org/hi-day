import { afterEach, describe, expect, it, vi } from "vitest";
import { getTimeEntries } from "@/lib/getTimeEntries";

// A successful response whose body is `entries`, carrying `nextCursor` in
// the paging header when given.
function page(entries: { id: string; projectName?: string }[], nextCursor?: string) {
  return {
    ok: true,
    headers: new Headers(nextCursor ? { "X-Next-Cursor": nextCursor } : {}),
    json: () => Promise.resolve(entries),
  };
}

describe("getTimeEntries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the entry list on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      page([{ id: "te-1", projectName: "Website" }]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTimeEntries("org-1");

    expect(result).toEqual({
      ok: true,
      entries: [{ id: "te-1", projectName: "Website" }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/time-entries",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("includes membershipId as a query param when given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(page([]));
    vi.stubGlobal("fetch", fetchMock);

    await getTimeEntries("org-1", { membershipId: "membership-2" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/time-entries?membershipId=membership-2",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("includes from/to as ISO query params when given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(page([]));
    vi.stubGlobal("fetch", fetchMock);
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-01-01T23:59:59.999Z");

    await getTimeEntries("org-1", { from, to });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/backend/organisations/org-1/time-entries?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getTimeEntries("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });

  it("follows every page for a from/to range, so no entry is dropped", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page([{ id: "te-1" }], "cursor-a"))
      .mockResolvedValueOnce(page([{ id: "te-2" }], "cursor-b"))
      .mockResolvedValueOnce(page([{ id: "te-3" }]));
    vi.stubGlobal("fetch", fetchMock);
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-01-31T23:59:59.999Z");

    const result = await getTimeEntries("org-1", { from, to });

    expect(result).toEqual({
      ok: true,
      entries: [{ id: "te-1" }, { id: "te-2" }, { id: "te-3" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain("cursor=cursor-a");
    expect(fetchMock.mock.calls[2][0]).toContain("cursor=cursor-b");
  });

  it("returns only the newest page when no range is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(page([{ id: "te-1" }], "cursor-a"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTimeEntries("org-1");

    expect(result).toEqual({ ok: true, entries: [{ id: "te-1" }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails the whole fetch when a later page fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(page([{ id: "te-1" }], "cursor-a"))
        .mockRejectedValueOnce(new Error("network")),
    );

    const result = await getTimeEntries("org-1", {
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-31T23:59:59.999Z"),
    });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });

  it("stops if the server repeats a cursor instead of looping forever", async () => {
    const fetchMock = vi.fn().mockResolvedValue(page([{ id: "te-1" }], "same"));
    vi.stubGlobal("fetch", fetchMock);

    await getTimeEntries("org-1", {
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-31T23:59:59.999Z"),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
