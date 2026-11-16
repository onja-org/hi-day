/**
 * How much input one activity period saw. Counts only: never which key,
 * what was typed, or where the mouse was or clicked.
 */
export interface InputCounts {
  keystrokes: number;
  mouseClicks: number;
  /** Distance the pointer travelled, in screen pixels. */
  mouseMovement: number;
}

/**
 * Why counting can't run, which the web shows as "not available" — never
 * as 0:
 * - `wayland`: Linux on Wayland blocks global input monitoring outright;
 *   a hook there would only see XWayland apps, giving wrong numbers rather
 *   than none.
 * - `permission`: macOS without Accessibility for this app.
 * - `blocked`: the hook was refused at start, e.g. by antivirus on Windows.
 * - `missing`: the native module couldn't be loaded on this build.
 */
export type InputCountsUnavailableReason =
  | 'wayland'
  | 'permission'
  | 'blocked'
  | 'missing';

/** The few events counting needs from a global input hook. */
export interface InputHook {
  onKeyDown(listener: (keycode: number) => void): void;
  onKeyUp(listener: (keycode: number) => void): void;
  onMouseDown(listener: () => void): void;
  onMouseMove(listener: (x: number, y: number) => void): void;
  start(): void;
  stop(): void;
}

export interface InputCounterDeps {
  /** Why counting can't run right now, or null when it can. Re-read at
   * every start and every period, since a permission can be granted or
   * revoked mid-session. */
  blocker: () => InputCountsUnavailableReason | null;
  /** The hook, or null when the native module isn't available. */
  loadHook: () => InputHook | null;
  log?: (line: string) => void;
}

/**
 * Counts keystrokes, clicks and pointer travel while a timer runs with
 * "Record activity" on. `take()` hands over one period's counts and starts
 * the next; it returns null for any period that couldn't be fully counted,
 * so a period is either really counted or "not available".
 */
export class InputCounter {
  private hook: InputHook | null = null;
  private hookLoaded = false;
  private running = false;
  /** Set when counting has been on for the whole current period. */
  private countingWholePeriod = false;
  private reason: InputCountsUnavailableReason | null = null;

  private keystrokes = 0;
  private mouseClicks = 0;
  private mouseMovement = 0;
  /**
   * Keys currently held, by code, so an auto-repeating held key counts as
   * one press. In memory only while held; never stored or sent.
   */
  private readonly held = new Set<number>();
  private lastPoint: { x: number; y: number } | null = null;

  constructor(private readonly deps: InputCounterDeps) {}

  /** Why counts aren't being collected, or null while they are. */
  get unavailableReason(): InputCountsUnavailableReason | null {
    return this.reason;
  }

  /** When the timer starts with Record activity on. */
  start(): void {
    this.reset();
    this.countingWholePeriod = this.tryListen();
  }

  /** When the timer stops or Record activity goes off. */
  stop(): void {
    this.unlisten();
    this.countingWholePeriod = false;
    this.reset();
  }

  /**
   * This period's counts, or null when it wasn't counted throughout, then
   * starts the next period. A hook that couldn't run at the start of the
   * period is retried here, so a permission granted mid-session counts from
   * the next period on.
   */
  take(): InputCounts | null {
    const counted = this.countingWholePeriod && this.deps.blocker() === null;
    const counts: InputCounts = {
      keystrokes: this.keystrokes,
      mouseClicks: this.mouseClicks,
      mouseMovement: Math.round(this.mouseMovement),
    };
    this.keystrokes = 0;
    this.mouseClicks = 0;
    this.mouseMovement = 0;

    // A revoked permission doesn't stop the hook loudly — it just goes
    // quiet, which would read as a real zero. Checked here, every period.
    if (this.running && this.deps.blocker() !== null) this.unlisten();
    this.countingWholePeriod = this.running || this.tryListen();
    return counted ? counts : null;
  }

  private tryListen(): boolean {
    if (this.running) return true;
    const blocker = this.deps.blocker();
    if (blocker) {
      this.reason = blocker;
      return false;
    }
    const hook = this.loadOnce();
    if (!hook) {
      this.reason = 'missing';
      return false;
    }
    try {
      hook.start();
    } catch (error) {
      this.deps.log?.(`[input-counter] hook refused to start: ${String(error)}`);
      this.reason = 'blocked';
      return false;
    }
    this.running = true;
    this.reason = null;
    return true;
  }

  private unlisten(): void {
    if (!this.running) return;
    this.running = false;
    try {
      this.hook?.stop();
    } catch (error) {
      this.deps.log?.(`[input-counter] hook failed to stop: ${String(error)}`);
    }
  }

  private loadOnce(): InputHook | null {
    if (this.hookLoaded) return this.hook;
    this.hookLoaded = true;
    this.hook = this.deps.loadHook();
    this.hook?.onKeyDown((keycode) => {
      if (!this.running || this.held.has(keycode)) return;
      this.held.add(keycode);
      this.keystrokes += 1;
    });
    this.hook?.onKeyUp((keycode) => {
      this.held.delete(keycode);
    });
    this.hook?.onMouseDown(() => {
      if (this.running) this.mouseClicks += 1;
    });
    this.hook?.onMouseMove((x, y) => {
      if (!this.running) return;
      if (this.lastPoint) {
        this.mouseMovement += Math.hypot(
          x - this.lastPoint.x,
          y - this.lastPoint.y,
        );
      }
      this.lastPoint = { x, y };
    });
    return this.hook;
  }

  private reset(): void {
    this.keystrokes = 0;
    this.mouseClicks = 0;
    this.mouseMovement = 0;
    this.held.clear();
    this.lastPoint = null;
  }
}
