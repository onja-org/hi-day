import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteUrlSession } from "@/lib/deleteUrlSession";

describe("deleteUrlSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a DELETE request with membershipId and url in the query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "URL session deleted" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await deleteUrlSession(
      "org-1",
      "member-1",
      "https://example.com/page",
    );

    expect(result).toEqual({ ok: true, message: "URL session deleted" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/url-sessions?membershipId=member-1&url=https%3A%2F%2Fexample.com%2Fpage",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "Member not found." }),
      }),
    );

    const result = await deleteUrlSession("org-1", "member-1", "https://example.com");

    expect(result).toEqual({
      ok: false,
      message: "Member not found.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await deleteUrlSession("org-1", "member-1", "https://example.com");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
