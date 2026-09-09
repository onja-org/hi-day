import { parse as parseTld } from 'tldts';

const INTERNAL_SCHEMES = ['chrome', 'edge', 'about', 'file'];

/**
 * The substring a "host" check should actually look at — everything after
 * a scheme (if present) up to the first /, ?, or #. Deliberately NOT the
 * whole raw string: a browser commonly displays a URL's path/query with
 * literal (decoded) spaces even though the host portion never legitimately
 * contains one, so checking the whole string for spaces would reject
 * perfectly good readings like "example.com/search results page".
 */
export function extractHostCandidate(raw: string): string {
  const withoutScheme = raw.includes('://') ? raw.slice(raw.indexOf('://') + 3) : raw;
  const boundary = withoutScheme.search(/[/?#]/);
  return boundary === -1 ? withoutScheme : withoutScheme.slice(0, boundary);
}

/**
 * Step 21 rule 2: "reject strings containing spaces, unless valid IDN." In
 * practice this reduces to "reject if the HOST portion has a space" — a
 * real IDN hostname is letters/digits/hyphens per IDNA rules and never
 * contains a literal space, so checking only the host candidate (not the
 * whole string) already implements the "unless valid IDN" carve-out
 * without a separate case: an otherwise-valid host is never rejected by
 * this check regardless of what the path/query happen to contain.
 */
export function hostCandidateHasSpace(raw: string): boolean {
  return extractHostCandidate(raw).includes(' ');
}

function matchInternalScheme(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  for (const scheme of INTERNAL_SCHEMES) {
    if (trimmed.startsWith(`${scheme}:`)) {
      return scheme;
    }
  }
  return null;
}

export interface HostValidation {
  valid: boolean;
  /** True for chrome:/edge:/about:/file: — canonicalize.ts handles these differently. */
  isInternalScheme: boolean;
}

/**
 * Step 21 rule 3: valid public suffix (tldts), an IP literal, localhost
 * (with or without a port — tldts already normalizes that away), or a
 * known internal scheme. tldts alone does NOT recognize chrome://,
 * edge://, about:, or file: URLs as anything meaningful — it just treats
 * whatever follows the scheme as an arbitrary (invalid) hostname — so
 * those are special-cased by scheme prefix before ever calling tldts.
 * This is deliberately the single rule that "kills most search-query
 * garbage" (Step 21's own framing): a typed phrase essentially never
 * happens to have a registered public suffix, be a valid IP, or be
 * "localhost".
 */
export function validateHost(raw: string): HostValidation {
  const internalScheme = matchInternalScheme(raw);
  if (internalScheme !== null) {
    return { valid: true, isInternalScheme: true };
  }

  const hostCandidate = extractHostCandidate(raw);
  if (hostCandidate.length === 0) {
    return { valid: false, isInternalScheme: false };
  }

  const parsed = parseTld(hostCandidate);
  const valid = parsed.domain !== null || parsed.isIp === true || parsed.hostname === 'localhost';
  return { valid, isInternalScheme: false };
}
