import { cookies } from "next/headers";
import { API_URL } from "./apiUrl";

const ACCESS_TOKEN_COOKIE = "access_token";

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/organisations/current`, {
      headers: { Cookie: `${ACCESS_TOKEN_COOKIE}=${token}` },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
