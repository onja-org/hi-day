import { afterEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import { getCurrentOrganisationId } from "@/lib/getCurrentOrganisationId";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

function mockCookies(token: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === "access_token" && token ? { value: token } : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

describe("getCurrentOrganisationId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns null when there is no access-token cookie", async () => {
    mockCookies(undefined);

    await expect(getCurrentOrganisationId()).resolves.toBeNull();
  });

  it("returns the organisation id when the backend confirms the session", async () => {
    mockCookies("valid-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 100000 }),
      }),
    );

    await expect(getCurrentOrganisationId()).resolves.toBe(100000);
  });

  it("returns null when the backend rejects the session", async () => {
    mockCookies("expired-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(getCurrentOrganisationId()).resolves.toBeNull();
  });

  it("returns null when the request throws", async () => {
    mockCookies("valid-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(getCurrentOrganisationId()).resolves.toBeNull();
  });
});
