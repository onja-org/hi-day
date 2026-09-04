import { cookies } from "next/headers";
import { BACKEND_ORIGIN } from "./backendOrigin";
import type { OrganisationProfile } from "@/types/organisation";

const ACCESS_TOKEN_COOKIE = "access_token";

/**
 * Server-side only: resolves the caller's organisation id from their
 * session cookie, for routes that need it before rendering (e.g. redirecting
 * `/dashboard` to `/dashboard/:organisationId/me`). Returns null for a
 * missing/invalid session rather than throwing — callers redirect on null.
 */
export async function getCurrentOrganisationId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_ORIGIN}/organisations/current`, {
      headers: { Cookie: `${ACCESS_TOKEN_COOKIE}=${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const organisation = (await response.json()) as OrganisationProfile;
    return organisation.id;
  } catch {
    return null;
  }
}
