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
      "http://localhost:3001/organisations/org-1/time-entries",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("includes membershipId as a query param when given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getTimeEntries("org-1", "membership-2");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/organisations/org-1/time-entries?membershipId=membership-2",
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
