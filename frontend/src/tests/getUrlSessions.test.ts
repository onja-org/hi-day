import { afterEach, describe, expect, it, vi } from "vitest";
import { getUrlSessions } from "@/lib/getUrlSessions";

describe("getUrlSessions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the caller's own tracked URLs when no membershipId is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ url: "https://example.com", host: "example.com" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getUrlSessions("org-1");

    expect(result).toEqual({
      ok: true,
      groups: [{ url: "https://example.com", host: "example.com" }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/url-sessions",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("includes membershipId in the query string when given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getUrlSessions("org-1", "member-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/url-sessions?membershipId=member-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "Only an admin or manager can view another member's website activity.",
          }),
      }),
    );

    const result = await getUrlSessions("org-1", "member-1");

    expect(result).toEqual({
      ok: false,
      message: "Only an admin or manager can view another member's website activity.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getUrlSessions("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
