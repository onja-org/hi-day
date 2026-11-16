import type { InputCounts } from './input-counter';

export const SEGMENT_MS = 10_000;
export const PERIOD_MS = 600_000; // Ten minutes — sixty segments.

const SEGMENTS_PER_PERIOD = PERIOD_MS / SEGMENT_MS;

export interface ActivitySample {
  activePercentage: number;
  periodStart: string;
  periodEnd: string;
  /**
   * Key presses, mouse clicks and pixels of pointer travel in the period.
   * All `null` when they couldn't be counted (see `InputCountsUnavailableReason`)
   * — "not available", never 0. Extra to the percentage, never its source.
   */
  keystrokes: number | null;
  mouseClicks: number | null;
  mouseMovement: number | null;
}

export type ActivitySampleSink = (
  sample: ActivitySample,
) => void | Promise<void>;

export interface ActivitySamplerDeps {
  /** Seconds since the last keyboard or mouse input. */
  readIdleSeconds: () => Promise<number>;
  /** This period's input counts, starting the next — see `InputCounter.take`.
   * Absent means counting isn't wired at all, which reports null too. */
  takeInputCounts?: () => InputCounts | null;
  now?: () => number;
}

/**
 * Hubstaff's activity method (docs/adr/0013-...): each ten-minute period is
 * sixty ten-second segments, and `activePercentage` is
 * `activeSegments / 60 * 100`.
 *
 * A segment counts as active when the idle reading is **below the segment
 * length** — the last input must have landed inside it. The original
 * implementation took this from `uiohook-napi`, a global input hook; reading
 * idle instead needs no native module and records strictly less: how long
 * since the last input, never that any input occurred, nor which.
 *
 * Nothing is emitted until a period closes — there is no meaningful partial
 * answer, unlike the window sampler's per-tick reading.
 *
 * Keystroke, click and movement counts ride along on each period when an
 * `InputCounter` supplies them. They need a global input hook, so they are
 * extra information beside the percentage, which still comes from idle
 * alone and keeps working exactly as before wherever counting can't.
 */
export class ActivitySampler {
  private readonly readIdleSeconds: () => Promise<number>;
  private readonly takeInputCounts: () => InputCounts | null;
  private readonly now: () => number;

  private periodStartMs: number | null = null;
  private activeSegments = 0;
  private segmentsSeen = 0;

  constructor(
    private readonly sink: ActivitySampleSink,
    deps: ActivitySamplerDeps,
  ) {
    this.readIdleSeconds = deps.readIdleSeconds;
    this.takeInputCounts = deps.takeInputCounts ?? (() => null);
    this.now = deps.now ?? Date.now;
  }

  /** Call once per segment while a timer is running. */
  async tick(): Promise<void> {
    const at = this.now();
    if (this.periodStartMs === null) {
      this.periodStartMs = at;
    }

    const idleSeconds = await this.readIdleSeconds();
    if (idleSeconds * 1000 < SEGMENT_MS) {
      this.activeSegments += 1;
    }
    this.segmentsSeen += 1;

    if (at - this.periodStartMs >= PERIOD_MS - SEGMENT_MS) {
      await this.closePeriod(at + SEGMENT_MS);
    }
  }

  /**
   * Emits whatever the current period has so far and starts a new one — for
   * when the timer stops mid-period, so the worked minutes aren't thrown
   * away. A period that saw no segments at all emits nothing.
   */
  async flush(): Promise<void> {
    if (this.periodStartMs === null || this.segmentsSeen === 0) {
      this.reset();
      return;
    }
    await this.closePeriod(this.now());
  }

  private async closePeriod(endMs: number): Promise<void> {
    const periodStartMs = this.periodStartMs!;
    // Always out of sixty, never out of the segments actually seen: a period
    // cut short by a stopped timer was genuinely inactive for the rest of
    // it, and scaling up would report a busier ten minutes than happened.
    const activePercentage = Math.round(
      (this.activeSegments / SEGMENTS_PER_PERIOD) * 100,
    );
    const counts = this.takeInputCounts();
    this.reset();

    await this.sink({
      activePercentage,
      periodStart: new Date(periodStartMs).toISOString(),
      periodEnd: new Date(endMs).toISOString(),
      keystrokes: counts?.keystrokes ?? null,
      mouseClicks: counts?.mouseClicks ?? null,
      mouseMovement: counts?.mouseMovement ?? null,
    });
  }

  private reset(): void {
    this.periodStartMs = null;
    this.activeSegments = 0;
    this.segmentsSeen = 0;
  }
}
