import { afterEach, describe, expect, it, vi } from "vitest";
import { logoutEverywhere } from "@/lib/logoutEverywhere";

describe("logoutEverywhere", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the logout-everywhere endpoint with credentials included", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await logoutEverywhere();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout-everywhere"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("does not throw when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(logoutEverywhere()).resolves.toBeUndefined();
  });
});
