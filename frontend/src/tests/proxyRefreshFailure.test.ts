// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function requestWithDeadSession(): NextRequest {
  return new NextRequest("https://www.hiday.io/dashboard", {
    headers: { cookie: "refresh_token=dead-token" },
  });
}

function refreshResponding(status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "x" }), {
          status,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
}

function clearedCookies(response: Response): string[] {
  return response.headers
    .getSetCookie()
    .filter((cookie) => /^(refresh_token|access_token)=;/.test(cookie));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("proxy, when the session refresh fails", () => {
  it.each([401, 403])(
    "drops the dead cookies on %i so later requests stop retrying",
    async (status) => {
      refreshResponding(status);

      const cleared = clearedCookies(await proxy(requestWithDeadSession()));

      expect(cleared).toHaveLength(2);
      // Must match the path the backend set them under, or nothing is cleared.
      expect(cleared.every((cookie) => /Path=\//.test(cookie))).toBe(true);
    },
  );

  it.each([429, 500, 503])(
    "leaves the session alone on %i, which says nothing about the token",
    async (status) => {
      refreshResponding(status);

      expect(clearedCookies(await proxy(requestWithDeadSession()))).toHaveLength(
        0,
      );
    },
  );
});
