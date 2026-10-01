import { cookies } from "next/headers";

const ACCESS_TOKEN_COOKIE = "access_token";

/**
 * Whether the browser sent a session cookie at all. Paired with a failed
 * \`isAuthenticated()\`, it tells "never logged in" apart from "had a session
 * that stopped working" (organisation deleted, account erased, expired).
 */
export async function hasSessionCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(ACCESS_TOKEN_COOKIE)?.value);
}
