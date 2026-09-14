import { canonicalize, type CanonicalizeOptions } from './canonicalize';
import { hostCandidateHasSpace, validateHost } from './host-validation';
import {
  isPlaceholder,
  loadPlaceholders,
  loadSensitivePathPatterns,
  matchesSensitivePathDenylist,
  type SensitivePathPatterns,
} from './denylists';

export type RejectionReason = 'contains-space' | 'invalid-host' | 'placeholder' | 'sensitive-path' | 'unparseable';

export type NormalizedReading = { ok: true; url: string; host: string; path: string | null };
export type RejectedReading = { ok: false; reason: RejectionReason };
export type NormalizationResult = NormalizedReading | RejectedReading;

export interface NormalizePipelineOptions {
  /**
   * Decision D1. Defaults to `keep` — the product needs the full URL,
   * search queries included. The sensitive-path rule above it in this
   * pipeline is what makes that safe; orgs wanting less set `strip`.
   */
  queryStringPolicy?: 'strip' | 'keep';
  /** Overridable for tests; defaults to loading placeholder-strings.json. */
  placeholders?: string[];
  /** Overridable for tests; defaults to loading sensitive-path-patterns.json. */
  sensitivePathPatterns?: SensitivePathPatterns;
}

const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Step 21's normalization pipeline. Focus rejection happens resolver-side
 * (the wire protocol carries no focus field); comparing against the
 * previous reading is session-engine.ts's job.
 *
 * Pure apart from lazily reading the two config files, which tests can
 * override. Drops the reading at the first failing rule.
 */
export function normalizeAddressBarReading(raw: string, options: NormalizePipelineOptions = {}): NormalizationResult {
  const placeholders = options.placeholders ?? loadPlaceholders();
  const sensitivePatterns = options.sensitivePathPatterns ?? loadSensitivePathPatterns();
  const queryStringPolicy = options.queryStringPolicy ?? 'keep';

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
    // Fragment included: implicit-flow tokens arrive as `#access_token=...`,
    // and fragments are now kept rather than discarded.
    pathAndQuery = preview.pathname + preview.search + preview.hash;
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
