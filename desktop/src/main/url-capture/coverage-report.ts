import type { Confidence } from './protocol';
import type { ResolverHealthSnapshot } from './resolver-health';

export type CoverageStatus = 'active' | 'degraded' | 'off';

export interface BrowserCoverageRow {
  key: string;
  installed: boolean;
  status: CoverageStatus;
  /** One sentence, user language — Step 25: what support reads to answer "why do I have no data" without a screen-share. */
  reason: string;
  /**
   * F.1 point 3 (decision D6): surfaced to end users on low-confidence
   * rows as an "approximate" marker. Undefined when installed is false —
   * there is nothing to rate the confidence of yet.
   */
  confidence?: Confidence;
  /**
   * Pre-computed via approximateNoteFor() below — undefined when no
   * marker is needed. Computed once here (main process) rather than
   * re-derived in the renderer: the renderer can't import this module
   * directly (a different compile target across the contextIsolation
   * boundary), and re-implementing the same confidence -> marker
   * decision there would risk silently drifting from this one.
   */
  approximateNote?: string;
}

export interface CoverageReport {
  platform: string;
  generatedAt: number;
  resolverHealth: ResolverHealthSnapshot;
  browsers: BrowserCoverageRow[];
}

/**
 * decision D6's "approximate" marker — confidence: "exact" never needs
 * one (it's a real internal API read, e.g. AppleScript's `url of active
 * tab`); "displayed" and "guess" are both readings of rendered text and
 * do, "guess" more so. Returns undefined (no marker) for "exact" or when
 * there's no reading to rate at all. Platform coverage builders
 * (resolvers/darwin/coverage.ts, resolvers/win32/coverage.ts) call this
 * once when constructing each row, rather than the renderer re-deriving
 * the same decision from a bare confidence value.
 */
export function approximateNoteFor(confidence: Confidence | undefined): string | undefined {
  if (confidence !== 'displayed' && confidence !== 'guess') return undefined;
  return confidence === 'guess'
    ? 'Approximate — this is a best-effort fallback, not a normal reading. See the reason above for what would fix it.'
    : 'Approximate — read from what is displayed on screen, not the browser\'s own internal data, so it may occasionally be off by a beat during a page transition.';
}
