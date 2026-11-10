import type { ScreenCastOutcome } from './screencast-portal';

export interface WaylandSilentCaptureDeps {
  loadToken: () => string | null;
  saveToken: (token: string | null) => void;
  /** `captureScreenViaScreenCast` — null token means "show the picker". */
  screenCast: (restoreToken: string | null) => Promise<ScreenCastOutcome>;
  /** `canGrabScreenCastFrames`. */
  canGrabFrames: () => Promise<boolean>;
}

export type WaylandGrantResult =
  /** Remembered: every later tick captures with no sound, flash or picker. */
  | { kind: 'granted'; buffer: Buffer }
  /** The person dismissed the picker — don't follow it with another dialog. */
  | { kind: 'cancelled' }
  /** Not possible here (or not remembered) — use the Screenshot portal. */
  | { kind: 'unavailable' };

/**
 * Keeps the ScreenCast restore token behind the silent Wayland capture
 * path (screencast-portal.ts). Tokens are single-use, so every outcome that
 * hands back a new one stores it, and one the portal rejected is dropped
 * at once — never offered again, since that would put the picker in front
 * of the person on every tick.
 */
export class WaylandSilentCapture {
  constructor(private readonly deps: WaylandSilentCaptureDeps) {}

  hasGrant(): boolean {
    return this.deps.loadToken() !== null;
  }

  /** Periodic tick: never shows UI. Null when there's nothing silent to do. */
  async capture(): Promise<Buffer | null> {
    const token = this.deps.loadToken();
    if (!token) return null;
    if (!(await this.deps.canGrabFrames())) return null;

    const outcome = await this.deps.screenCast(token);
    switch (outcome.kind) {
      case 'captured':
        this.deps.saveToken(outcome.restoreToken);
        return outcome.buffer;
      case 'token-rejected':
        this.deps.saveToken(null);
        return null;
      case 'failed':
        // Undefined: the session never started, so the old token still stands.
        if (outcome.restoreToken !== undefined) {
          this.deps.saveToken(outcome.restoreToken);
        }
        return null;
      default:
        return null;
    }
  }

  /** Only ever from an explicit "Grant Access" click — shows the picker. */
  async grant(): Promise<WaylandGrantResult> {
    if (!(await this.deps.canGrabFrames())) return { kind: 'unavailable' };

    const outcome = await this.deps.screenCast(null);
    if (outcome.kind === 'cancelled') return { kind: 'cancelled' };
    if (outcome.kind === 'captured' && outcome.restoreToken) {
      this.deps.saveToken(outcome.restoreToken);
      return { kind: 'granted', buffer: outcome.buffer };
    }
    if (outcome.kind === 'failed' && outcome.restoreToken) {
      // Granted and remembered, but no frame this time — keep it for ticks.
      this.deps.saveToken(outcome.restoreToken);
    }
    return { kind: 'unavailable' };
  }
}
