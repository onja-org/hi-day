import type { ScreenCastOutcome } from './screencast-portal';

export interface WaylandSilentCaptureDeps {
  /** The remembered choice for one screen setup — see screen-setup.ts. */
  loadToken: (setup: string) => string | null;
  saveToken: (setup: string, token: string | null) => void;
  /** Which screens are connected now; one setup when omitted. */
  currentSetup?: () => string;
  /** `captureScreenViaScreenCast` — null token means "show the picker". */
  screenCast: (restoreToken: string | null) => Promise<ScreenCastOutcome>;
  /** `isSilentScreenCastAvailable` — GStreamer present and the portal new enough. */
  isAvailable: () => Promise<boolean>;
}

export type WaylandGrantResult =
  /** Remembered: every later tick captures with no sound, flash or picker. */
  | { kind: 'granted'; buffer: Buffer }
  /** The person dismissed the picker — don't follow it with another dialog. */
  | { kind: 'cancelled' }
  /** Not possible here (or not remembered) — use the Screenshot portal. */
  | { kind: 'unavailable' };

/**
 * Rejections in a row before the remembered choice is given up. One is not
 * enough: GNOME answers a perfectly good token with the picker just after
 * the lid opens, and its portal has been seen to crash doing it, so a
 * single rejection dropped the grant and sent the person back to "Grant
 * Access" after every lid close. A token that is really gone (the grant
 * revoked, the monitor replaced) still goes after three ticks.
 */
const REJECTIONS_BEFORE_DROPPING = 3;

/**
 * Keeps the ScreenCast restore token behind the silent Wayland capture path
 * (screencast-portal.ts). Every outcome that hands back a token stores it in
 * place of the old one; a token rejected several ticks in a row is dropped,
 * since reusing it would put the picker in front of the person on every tick.
 */
export class WaylandSilentCapture {
  /** Per screen setup, like the tokens themselves. */
  private readonly rejectionsInARow = new Map<string, number>();

  constructor(private readonly deps: WaylandSilentCaptureDeps) {}

  private currentSetup(): string {
    return this.deps.currentSetup?.() ?? 'default';
  }

  /**
   * For the screens connected now. A setup never granted — the lid closed
   * on a monitor, say — has none, so "Grant Access" is offered for it while
   * the other setups keep theirs.
   */
  hasGrant(): boolean {
    return this.deps.loadToken(this.currentSetup()) !== null;
  }

  /**
   * Periodic tick: never shows UI. Null when there's nothing silent to do.
   * Only the current setup's choice is tried: one made for a screen that is
   * not connected would show the picker, and GNOME would then forget it.
   */
  async capture(): Promise<Buffer | null> {
    const setup = this.currentSetup();
    const token = this.deps.loadToken(setup);
    if (!token) return null;
    if (!(await this.deps.isAvailable())) return null;

    const outcome = await this.deps.screenCast(token);
    switch (outcome.kind) {
      case 'captured':
        this.rejectionsInARow.delete(setup);
        this.deps.saveToken(setup, outcome.restoreToken);
        return outcome.buffer;
      case 'token-rejected': {
        const rejections = (this.rejectionsInARow.get(setup) ?? 0) + 1;
        if (rejections >= REJECTIONS_BEFORE_DROPPING) {
          this.rejectionsInARow.delete(setup);
          this.deps.saveToken(setup, null);
        } else {
          this.rejectionsInARow.set(setup, rejections);
        }
        return null;
      }
      case 'failed':
        // Undefined: the session never started, so the old token still stands.
        if (outcome.restoreToken !== undefined) {
          this.deps.saveToken(setup, outcome.restoreToken);
        }
        return null;
      default:
        return null;
    }
  }

  /** Whether asking for a grant could succeed here. False means an existing
   * Screenshot-portal grant is the best there is and must keep counting. */
  canBeGranted(): Promise<boolean> {
    return this.deps.isAvailable();
  }

  /** Only ever from an explicit "Grant Access" click — shows the picker. */
  async grant(): Promise<WaylandGrantResult> {
    if (!(await this.deps.isAvailable())) return { kind: 'unavailable' };

    const setup = this.currentSetup();
    const outcome = await this.deps.screenCast(null);
    if (outcome.kind === 'cancelled') return { kind: 'cancelled' };
    if (outcome.kind === 'captured' && outcome.restoreToken) {
      this.rejectionsInARow.delete(setup);
      this.deps.saveToken(setup, outcome.restoreToken);
      return { kind: 'granted', buffer: outcome.buffer };
    }
    if (outcome.kind === 'failed' && outcome.restoreToken) {
      // Granted and remembered, but no frame this time — keep it for ticks.
      this.deps.saveToken(setup, outcome.restoreToken);
    }
    return { kind: 'unavailable' };
  }
}
