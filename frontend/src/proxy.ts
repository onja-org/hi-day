import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// The access-token cookie is short-lived relative to the refresh token
// (ACCESS_TOKEN_TTL_DAYS, backend/.env) so sessions stay safe after a
// password reset revokes them. Without this, a valid refresh token wouldn't
// do anything for page loads — the server-side isAuthenticated() check only
// reads cookies, it can't call /auth/refresh and set new ones (Server
// Components can't write outgoing cookies). Proxy can.
export async function proxy(request: NextRequest) {
  if (request.cookies.has("access_token")) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get("refresh_token");
  if (!refreshToken) {
    return NextResponse.next();
  }

  try {
    // This runs server-side (Node.js runtime), so it must hit the backend's
    // real origin directly — API_URL's "/api/backend" rewrite path only
    // resolves relative to a browser's own location, not from here.
    const refreshResponse = await fetch(`${BACKEND_ORIGIN}/auth/refresh`, {
      method: "POST",
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });

    if (!refreshResponse.ok) {
      return NextResponse.next();
    }

    const setCookies = refreshResponse.headers.getSetCookie();

    // Also apply the refreshed values to the *current* request's cookie
    // header, not just the response — otherwise this request still carries
    // the stale/missing access_token onward to the rewrite-proxied backend
    // call and to server-side isAuthenticated() checks, bouncing the user
    // to login despite the refresh having just succeeded.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(
      "cookie",
      mergeCookieHeader(requestHeaders.get("cookie"), setCookies),
    );

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    for (const cookie of setCookies) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch {
    return NextResponse.next();
  }
}

function mergeCookieHeader(
  existingCookieHeader: string | null,
  setCookies: string[],
): string {
  const cookieJar = new Map<string, string>();

  for (const pair of (existingCookieHeader ?? "").split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name) {
      cookieJar.set(name, rest.join("="));
    }
  }

  for (const setCookie of setCookies) {
    const [name, ...rest] = setCookie.split(";")[0].trim().split("=");
    if (name) {
      cookieJar.set(name, rest.join("="));
    }
  }

  return Array.from(cookieJar, ([name, value]) => `${name}=${value}`).join(
    "; ",
  );
}
