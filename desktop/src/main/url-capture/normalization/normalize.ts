import { canonicalize, type CanonicalizeOptions } from './canonicalize';
import { hostCandidateHasSpace, validateHost } from './host-validation';
import { isPlaceholder, loadPlaceholders } from './placeholder-detector';
import { loadSensitivePathPatterns, matchesSensitivePathDenylist, type SensitivePathPatterns } from './sensitive-path';

export type RejectionReason = 'contains-space' | 'invalid-host' | 'placeholder' | 'sensitive-path' | 'unparseable';

export type NormalizedReading = { ok: true; url: string; host: string; path: string | null };
export type RejectedReading = { ok: false; reason: RejectionReason };
export type NormalizationResult = NormalizedReading | RejectedReading;

export interface NormalizePipelineOptions {
  /** Decision D1 — org-configurable; strip is the safer default. */
  queryStringPolicy?: 'strip' | 'keep';
  /** Overridable for tests; defaults to loading placeholder-strings.json. */
  placeholders?: string[];
  /** Overridable for tests; defaults to loading sensitive-path-patterns.json. */
  sensitivePathPatterns?: SensitivePathPatterns;
}

const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Steps 2-9 of docs/url-tracking-plan.md Step 21's normalization pipeline.
 * Step 1 (reject if the address bar has keyboard focus) is enforced
 * resolver-side instead — the pinned wire protocol carries no field for
 * that state to Electron, so a rejected-for-focus reading never reaches
 * this pipeline as a candidate at all (see e.g. win-resolver's
 * AddressBarSelector). Step 10 (compare with the previous reading —
 * identical extends the session, different opens a new one) is
 * session-engine.ts's existing job, downstream of this pipeline's output,
 * not reimplemented here.
 *
 * Pure: no clock, no network, no side effects. The only I/O is the
 * (lazily loaded, cacheable) config file reads for placeholders/
 * sensitive-path patterns, which callers can override entirely for tests.
 * Drops the reading at the first failing rule, per Step 21.
 */
export function normalizeAddressBarReading(raw: string, options: NormalizePipelineOptions = {}): NormalizationResult {
  const placeholders = options.placeholders ?? loadPlaceholders();
  const sensitivePatterns = options.sensitivePathPatterns ?? loadSensitivePathPatterns();
  const queryStringPolicy = options.queryStringPolicy ?? 'strip';

  if (hostCandidateHasSpace(raw)) {
    return { ok: false, reason: 'contains-space' };
  }

  if (!validateHost(raw).valid) {
    return { ok: false, reason: 'invalid-host' };
  }

  if (isPlaceholder(raw, placeholders)) {
    return { ok: false, reason: 'placeholder' };
  }

  // Sensitive-path check runs against the path+query BEFORE
  // canonicalize()'s query-string policy strips it — deliberately
  // reordered from Step 21's listed 7-then-9 numbering: a token-bearing
  // query must reject the whole reading, not just have its query
  // silently dropped by the ordinary (default: strip) policy, which would
  // otherwise make this check meaningless in the default configuration.
  const trimmed = raw.trim();
  const withScheme = SCHEME_PREFIX.test(trimmed) ? trimmed : `https://${trimmed}`;
  let pathAndQuery: string;
  try {
    const preview = new URL(withScheme);
    pathAndQuery = preview.pathname + preview.search;
  } catch {
    return { ok: false, reason: 'unparseable' };
  }
  if (matchesSensitivePathDenylist(pathAndQuery, sensitivePatterns)) {
    return { ok: false, reason: 'sensitive-path' };
  }

  const canonicalizeOptions: CanonicalizeOptions = { queryStringPolicy };
  const canonicalized = canonicalize(raw, canonicalizeOptions);
  if (canonicalized === null) {
    return { ok: false, reason: 'unparseable' };
  }

  return { ok: true, ...canonicalized };
}
