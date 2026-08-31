import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentOrganisation } from "@/lib/getCurrentOrganisation";

describe("getCurrentOrganisation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the organisation profile on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "org-1",
            name: "Acme Inc",
            address: "1 Main St",
            website: "https://acme.test",
            role: "admin",
          }),
      }),
    );

    const result = await getCurrentOrganisation();

    expect(result).toEqual({
      ok: true,
      organisation: {
        id: "org-1",
        name: "Acme Inc",
        address: "1 Main St",
        website: "https://acme.test",
        role: "admin",
      },
    });
  });

  it("returns the backend's error message when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "No organisation found for this user." }),
      }),
    );

    const result = await getCurrentOrganisation();

    expect(result).toEqual({
      ok: false,
      message: "No organisation found for this user.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getCurrentOrganisation();

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
