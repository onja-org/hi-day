import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmOrganisationDeletion } from "@/lib/confirmOrganisationDeletion";

describe("confirmOrganisationDeletion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Organisation suspended" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await confirmOrganisationDeletion(100000, "tok");

    expect(result).toEqual({
      ok: true,
      message: "Organisation suspended",
      signedOut: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/100000/deletion/confirm",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ token: "tok" }) }),
    );
  });

  it("passes on that the caller was signed out by a permanent deletion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "Permanent deletion has started.",
            signedOut: true,
          }),
      }),
    );

    const result = await confirmOrganisationDeletion(100000, "tok");

    expect(result).toEqual({
      ok: true,
      message: "Permanent deletion has started.",
      signedOut: true,
    });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Only the organisation owner can delete or restore the account." }),
      }),
    );

    const result = await confirmOrganisationDeletion(100000, "tok");

    expect(result).toEqual({
      ok: false,
      message: "Only the organisation owner can delete or restore the account.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await confirmOrganisationDeletion(100000, "tok");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
