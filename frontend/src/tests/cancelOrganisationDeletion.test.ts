import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelOrganisationDeletion } from "@/lib/cancelOrganisationDeletion";

describe("cancelOrganisationDeletion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Organisation restored" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await cancelOrganisationDeletion(100000);

    expect(result).toEqual({ ok: true, message: "Organisation restored" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/100000/deletion/cancel",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Only the organisation owner can delete or restore the account." }),
      }),
    );

    const result = await cancelOrganisationDeletion(100000);

    expect(result).toEqual({
      ok: false,
      message: "Only the organisation owner can delete or restore the account.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await cancelOrganisationDeletion(100000);

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
