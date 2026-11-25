import { afterEach, describe, expect, it, vi } from "vitest";
import { approveDevicePairing } from "@/lib/approveDevicePairing";

describe("approveDevicePairing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Device approved" }),
      }),
    );

    const result = await approveDevicePairing("the-code");

    expect(result).toEqual({ ok: true, message: "Device approved" });
  });

  it("sends the chosen organisation with the approval", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Device approved" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await approveDevicePairing("the-code", "org-b");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/device-pairing/the-code/approve"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ organisationId: "org-b" }),
      }),
    );
  });

  it("surfaces the backend's message when no organisation was chosen (400)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            message: "Choose which organisation to link this device to.",
          }),
      }),
    );

    const result = await approveDevicePairing("the-code");

    expect(result).toEqual({
      ok: false,
      message: "Choose which organisation to link this device to.",
    });
  });

  it("returns an invalid-link message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await approveDevicePairing("bad-code");

    expect(result).toEqual({
      ok: false,
      message: "This link is invalid or has expired.",
    });
  });

  it("surfaces the backend's message when the organisation is suspended (403)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: "Your account is suspended." }),
      }),
    );

    const result = await approveDevicePairing("the-code");

    expect(result).toEqual({ ok: false, message: "Your account is suspended." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await approveDevicePairing("the-code");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
