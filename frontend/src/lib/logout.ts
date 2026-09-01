import { API_URL } from "./apiUrl";

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort: the caller redirects regardless of whether this succeeds.
  }
}
