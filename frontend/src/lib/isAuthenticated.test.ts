import { afterEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { isAuthenticated } from "./isAuthenticated";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

function mockCookies(token: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === "access_token" && token ? { value: token } : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

describe("isAuthenticated", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns false when there is no access-token cookie", async () => {
    mockCookies(undefined);

    await expect(isAuthenticated()).resolves.toBe(false);
  });

  it("returns true when the backend confirms the session", async () => {
    mockCookies("valid-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await expect(isAuthenticated()).resolves.toBe(true);
  });

  it("returns false when the backend rejects the session", async () => {
    mockCookies("expired-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(isAuthenticated()).resolves.toBe(false);
  });

  it("returns false when the request throws", async () => {
    mockCookies("valid-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(isAuthenticated()).resolves.toBe(false);
  });
});
