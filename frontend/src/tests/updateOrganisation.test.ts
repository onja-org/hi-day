import { afterEach, describe, expect, it, vi } from "vitest";
import { updateOrganisation } from "@/lib/updateOrganisation";

const validInput = {
  name: "Acme International",
  address: "2 New St",
  website: "https://acme.test",
};

describe("updateOrganisation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the updated organisation profile on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 100000,
            name: "Acme International",
            address: "2 New St",
            website: "https://acme.test",
            role: "admin",
          }),
      }),
    );

    const result = await updateOrganisation(100000, validInput);

    expect(result).toEqual({
      ok: true,
      organisation: {
        id: 100000,
        name: "Acme International",
        address: "2 New St",
        website: "https://acme.test",
        role: "admin",
      },
    });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message:
              "Only an admin of this organisation can update its settings.",
          }),
      }),
    );

    const result = await updateOrganisation(100000, validInput);

    expect(result).toEqual({
      ok: false,
      message: "Only an admin of this organisation can update its settings.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await updateOrganisation(100000, validInput);

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
