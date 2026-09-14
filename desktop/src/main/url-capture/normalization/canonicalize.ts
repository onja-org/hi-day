const MAX_PATH_LENGTH = 512;
// Requires "://" so "localhost:3000" isn't read as scheme "localhost".
// about: has no authority, so it needs its own pattern.
const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:\/\//i;
const ABOUT_SCHEME_PREFIX = /^about:/i;
const INTERNAL_PROTOCOLS = new Set(['chrome:', 'edge:', 'about:', 'file:']);

export interface CanonicalizeOptions {
  /** Decision D1. No default — normalize.ts sets the pipeline default (`keep`). */
  queryStringPolicy: 'strip' | 'keep';
}

export interface Canonicalized {
  url: string;
  host: string;
  path: string | null;
}

/**
 * Runs only after validateHost/isPlaceholder have passed. Returns null if
 * parsing still fails, so this never throws into the pipeline.
 */
export function canonicalize(raw: string, options: CanonicalizeOptions): Canonicalized | null {
  const trimmed = raw.trim();
  // Assuming https is why these readings are confidence "displayed", never
  // "exact". Schemes already present (chrome://, about:) are left alone.
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

  // The URL parser lowercases the host and drops default ports for free.
  // A non-default port is kept. A bare "/" counts as no path.
  const host = url.port ? `${url.hostname}:${url.port}` : url.hostname;
  let path: string | null = url.pathname === '/' || url.pathname === '' ? null : url.pathname;

  // Decision D1 — keep by default.
  const keepFullUrl = options.queryStringPolicy === 'keep';
  const query = keepFullUrl ? url.search : '';

  // Deviates from Step 21, which stripped the fragment. For an SPA the
  // fragment IS the location: Gmail's #inbox and #sent are different
  // screens. Same policy as the query — `keep` means the whole URL. The
  // denylist in normalize.ts matches fragments, so implicit-flow tokens
  // are still rejected.
  const fragment = keepFullUrl ? url.hash : '';

  // Truncate path+query+fragment together.
  if (path !== null || query.length > 0 || fragment.length > 0) {
    path = truncatePath((path ?? '') + query + fragment);
  }

  return { url: `https://${host}${path ?? ''}`, host, path };
}

/**
 * Internal schemes have no DNS host, so each supplies its own grouping key:
 * chrome:/edge: use the authority, about: its opaque path, file: a fixed
 * "file" host (the real path is per-machine and groups nothing).
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
