import { afterEach, describe, expect, it, vi } from "vitest";
import { logout } from "./logout";

describe("logout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the logout endpoint with credentials included", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("does not throw when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(logout()).resolves.toBeUndefined();
  });
});
