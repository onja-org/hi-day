import { afterEach, describe, expect, it, vi } from "vitest";
import { getOrganisationDeletionStatus } from "@/lib/getOrganisationDeletionStatus";

describe("getOrganisationDeletionStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the status on success", async () => {
    const status = { state: "active", graceDays: 30 };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(status),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getOrganisationDeletionStatus(100000);

    expect(result).toEqual({ ok: true, status });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/100000/deletion",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Forbidden" }),
      }),
    );

    expect(await getOrganisationDeletionStatus(100000)).toEqual({
      ok: false,
      message: "Forbidden",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    expect(await getOrganisationDeletionStatus(100000)).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
