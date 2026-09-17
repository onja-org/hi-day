import { API_URL } from "./apiUrl";

export async function logoutEverywhere(): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout-everywhere`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort: the caller redirects regardless of whether this succeeds.
  }
}
