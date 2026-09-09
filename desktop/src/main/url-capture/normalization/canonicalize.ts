const MAX_PATH_LENGTH = 512;
// Requires "://", not just "word:" — a bare "localhost:3000" or
// "example.com:8080" must NOT be mistaken for a URI with scheme
// "localhost"/"example.com" (an ambiguity a naive `^[a-z][a-z0-9+.-]*:`
// regex falls into, since a host:port pair is syntactically
// indistinguishable from scheme:opaque-data without this). about: is the
// one real exception — it has no "//" authority at all — so it's matched
// explicitly alongside.
const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:\/\//i;
const ABOUT_SCHEME_PREFIX = /^about:/i;
const INTERNAL_PROTOCOLS = new Set(['chrome:', 'edge:', 'about:', 'file:']);

export interface CanonicalizeOptions {
  /** Decision D1 — org-configurable; strip is the safer default. */
  queryStringPolicy: 'strip' | 'keep';
}

export interface Canonicalized {
  url: string;
  host: string;
  path: string | null;
}

/**
 * Steps 5-8 of Step 21, run only once a reading has already passed
 * validateHost/isPlaceholder — by this point the string is trusted to be
 * URL-parseable. Returns null only if URL parsing still somehow fails
 * (defensive: validateHost's own logic should already rule this out, but
 * this must never throw uncaught into the pipeline).
 */
export function canonicalize(raw: string, options: CanonicalizeOptions): Canonicalized | null {
  const trimmed = raw.trim();
  // Step 5: re-add the scheme, assuming https — this assumption is
  // exactly why UIA/AX/AT-SPI2 readings are confidence: "displayed" and
  // never "exact": we cannot know from a rendered string alone whether
  // the real page was http or https. Only applies when there's no scheme
  // at all — chrome://, about:, etc. already have one and must keep it;
  // rewriting them to "https://" would misleadingly claim they're real
  // web pages.
  const alreadyHasScheme = SCHEME_PREFIX.test(trimmed) || ABOUT_SCHEME_PREFIX.test(trimmed);
  const withScheme = alreadyHasScheme ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (INTERNAL_PROTOCOLS.has(url.protocol)) {
    return canonicalizeInternalScheme(url);
  }

  // Step 6 canonicalization: URL's own parser already lowercases the
  // hostname and drops a port that matches the scheme's default (both for
  // free) — url.port is only ever non-empty here for a genuinely
  // non-default port (e.g. "localhost:3000"), which Step 21 says to keep,
  // not strip, so it's appended back rather than discarded. What's left
  // to do explicitly is: strip the fragment ALWAYS (never conditional on
  // policy — Step 21 is explicit about this — done implicitly here by
  // never reading url.hash at all), and treat a bare host's "/" pathname
  // as no path rather than a literal trailing slash.
  const host = url.port ? `${url.hostname}:${url.port}` : url.hostname;
  let path: string | null = url.pathname === '/' || url.pathname === '' ? null : url.pathname;

  // Step 7: query-string policy (decision D1) — strip by default.
  const query = options.queryStringPolicy === 'keep' ? url.search : '';

  // Step 8: truncate the path at 512 chars — applied to path+query
  // together, since query is what actually got appended back on.
  if (path !== null || query.length > 0) {
    path = truncatePath((path ?? '') + query);
  }

  return { url: `https://${host}${path ?? ''}`, host, path };
}

/**
 * chrome://, edge://, about:, file: — never rewritten to https, and
 * grouped differently since they have no real DNS host:
 *  - chrome:/edge: have a real authority component (e.g. "settings" in
 *    chrome://settings/passwords) — host is that authority, same
 *    canonicalization as a normal host otherwise.
 *  - about: has no authority at all (an "opaque path" scheme — its
 *    pathname carries the whole identifier with no leading slash, e.g.
 *    "blank"); that stands in for "host" since there's no further
 *    structure worth calling a separate path.
 *  - file: carries a local file path with no real host — grouped under a
 *    fixed synthetic host ("file") rather than a per-machine path, since
 *    the actual path isn't a meaningful cross-device grouping key.
 */
function canonicalizeInternalScheme(url: URL): Canonicalized {
  if (url.protocol === 'about:') {
    return { url: `about:${url.pathname}`, host: url.pathname, path: null };
  }

  if (url.protocol === 'file:') {
    const path = url.pathname.length > 0 ? truncatePath(url.pathname) : null;
    return { url: `file://${path ?? ''}`, host: 'file', path };
  }

  const host = url.hostname;
  const path = url.pathname === '' || url.pathname === '/' ? null : truncatePath(url.pathname);
  return { url: `${url.protocol}//${host}${path ?? ''}`, host, path };
}

function truncatePath(path: string): string {
  return path.length > MAX_PATH_LENGTH ? path.slice(0, MAX_PATH_LENGTH) : path;
}
