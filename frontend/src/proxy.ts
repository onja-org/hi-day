import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { API_URL } from "@/lib/apiUrl";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// The access-token cookie is short-lived (15 minutes) so sessions stay safe
// after a password reset revokes them. Without this, a valid refresh token
// wouldn't do anything for page loads — the server-side isAuthenticated()
// check only reads cookies, it can't call /auth/refresh and set new ones
// (Server Components can't write outgoing cookies). Proxy can.
export async function proxy(request: NextRequest) {
  if (request.cookies.has("access_token")) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get("refresh_token");
  if (!refreshToken) {
    return NextResponse.next();
  }

  try {
    const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });

    if (!refreshResponse.ok) {
      return NextResponse.next();
    }

    const response = NextResponse.next();
    for (const cookie of refreshResponse.headers.getSetCookie()) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch {
    return NextResponse.next();
  }
}
