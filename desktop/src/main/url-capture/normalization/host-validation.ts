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
 * Accepts a valid public suffix, an IP literal, localhost, or an internal
 * scheme. Internal schemes are matched first because tldts treats whatever
 * follows them as an invalid hostname.
 *
 * This is the rule that kills most typed-search garbage: a phrase rarely
 * has a registered public suffix.
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
