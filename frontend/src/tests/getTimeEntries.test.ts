import { afterEach, describe, expect, it, vi } from "vitest";
import { getTimeEntries } from "@/lib/getTimeEntries";

describe("getTimeEntries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the entry list on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "te-1", projectName: "Website" }]),
    });
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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getTimeEntries("org-1", { membershipId: "membership-2" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/time-entries?membershipId=membership-2",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("includes from/to as ISO query params when given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
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
});
