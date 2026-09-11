const DEFAULT_PATH = "/dashboard";

/**
 * Only ever returns an internal path — a bare "https://evil.example" or a
 * protocol-relative "//evil.example" would send someone off-site right
 * after they log in, so anything not shaped like a same-app path falls
 * back to `DEFAULT_PATH` instead.
 */
export function safeRedirectPath(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return DEFAULT_PATH;
}
