const CODE_PREFIX = /^\[([a-z0-9-]+)\]/i;

/**
 * Extracts the leading `[code]` tag resolvers embed in a failure message.
 * The wire protocol's ErrorResponse has no code field, so this is the only
 * way to bucket failures by type. Returns "unknown" for messages that don't
 * follow the convention.
 */
export function extractResolverErrorCode(message: string): string {
  const match = CODE_PREFIX.exec(message);
  return match ? match[1].toLowerCase() : 'unknown';
}

export type ResolverLifecycleState = 'starting' | 'ready' | 'restarting' | 'degraded';

export interface ResolverHealthSnapshot {
  state: ResolverLifecycleState;
  lastReadyAt: number | null;
  lastSuccessfulResolveAt: number | null;
  /** Counts over the last MAX_RECENT_ERRORS resolve() failures, not all-time. */
  recentErrorCounts: Record<string, number>;
  /** What the side-car said it can do when it came up; null before then. */
  caps: string[] | null;
  /**
   * The side-car's own account of why it is short of a capability — an
   * unsupported desktop session, an unreachable accessibility bus. Written
   * for the person, never carries a URL.
   */
  lastErrorDetail: string | null;
}

const MAX_RECENT_ERRORS = 20;

/**
 * F.1 (Step 25): "resolver health, and the last N resolver error codes
 * with counts" — one instance per ResolverOrchestrator, fed by its
 * existing ResolverManager event handlers. Never touches a URL or any
 * reading content — only lifecycle state and error codes — so this is
 * safe to upload verbatim in a capability report with no separate
 * redaction step.
 */
export class ResolverHealthTracker {
  private state: ResolverLifecycleState = 'starting';
  private lastReadyAt: number | null = null;
  private lastSuccessfulResolveAt: number | null = null;
  private caps: string[] | null = null;
  private lastErrorDetail: string | null = null;
  private readonly recentErrors: string[] = [];

  onReady(nowMs: number, caps: string[] = []): void {
    this.state = 'ready';
    this.lastReadyAt = nowMs;
    this.caps = caps;
    this.lastErrorDetail = null;
  }

  onSideCarError(detail: string): void {
    this.lastErrorDetail = detail;
  }

  onRestarting(): void {
    this.state = 'restarting';
  }

  onDegraded(): void {
    this.state = 'degraded';
  }

  onSuccessfulResolve(nowMs: number): void {
    this.lastSuccessfulResolveAt = nowMs;
  }

  onResolveFailure(message: string): void {
    this.recentErrors.push(extractResolverErrorCode(message));
    if (this.recentErrors.length > MAX_RECENT_ERRORS) {
      this.recentErrors.shift();
    }
  }

  snapshot(): ResolverHealthSnapshot {
    const recentErrorCounts: Record<string, number> = {};
    for (const code of this.recentErrors) {
      recentErrorCounts[code] = (recentErrorCounts[code] ?? 0) + 1;
    }
    return {
      state: this.state,
      lastReadyAt: this.lastReadyAt,
      lastSuccessfulResolveAt: this.lastSuccessfulResolveAt,
      recentErrorCounts,
      caps: this.caps,
      lastErrorDetail: this.lastErrorDetail,
    };
  }
}
