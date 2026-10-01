import { afterEach, describe, expect, it, vi } from "vitest";
import { requestOrganisationDeletion } from "@/lib/requestOrganisationDeletion";

describe("requestOrganisationDeletion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Check your email" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestOrganisationDeletion(100000, { mode: "now", confirmName: "Acme" });

    expect(result).toEqual({ ok: true, message: "Check your email" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/100000/deletion/request",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ mode: "now", confirmName: "Acme" }) }),
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

    const result = await requestOrganisationDeletion(100000, { mode: "now", confirmName: "Acme" });

    expect(result).toEqual({
      ok: false,
      message: "Only the organisation owner can delete or restore the account.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await requestOrganisationDeletion(100000, { mode: "now", confirmName: "Acme" });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
