const DEFAULT_PATH = "/dashboard";
const PLACEHOLDER_ORIGIN = "https://hiday.invalid";

/**
 * Only ever returns an internal path — a bare "https://evil.example" or a
 * protocol-relative "//evil.example" would send someone off-site right
 * after they log in, so anything not shaped like a same-app path falls
 * back to `DEFAULT_PATH` instead.
 *
 * `next` is resolved the way the browser will resolve it, rather than just
 * checked for a leading "//": the browser reads "/\evil.example" as
 * "//evil.example" and drops tabs and newlines, so a string check alone
 * lets those through.
 */
export function safeRedirectPath(next: string | undefined): string {
  if (!next || !next.startsWith("/")) return DEFAULT_PATH;

  const resolved = new URL(next, PLACEHOLDER_ORIGIN);
  if (resolved.origin !== PLACEHOLDER_ORIGIN) return DEFAULT_PATH;

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
