/**
 * Decides when to nudge someone whose agent is open with no timer
 * running. No schedule: idle time is the whole signal, which keeps it
 * quiet at a laptop left open over a weekend and works for anyone whose
 * hours are not nine to five.
 */
export type ReminderDelivery = 'notification' | 'alert';

export interface ReminderSettings {
  /** `0` switches reminders off. */
  intervalMinutes: number;
  delivery: ReminderDelivery;
  /** So the reminder can say how much of the day is left to track. */
  workingHoursPerDay: number;
}

export interface ReminderInput {
  /** Undefined as well as null: a cache written by an older build, or a
   * server that does not send the field, must simply mean "off". */
  settings: ReminderSettings | null | undefined;
  now: Date;
  isTracking: boolean;
  /** Seconds since the last keyboard or mouse input. */
  idleSeconds: number;
  /**
   * When this untracked stretch last got attention — the app starting, a
   * timer stopping, or the previous reminder. Never null, so one rule
   * covers the first nudge and every repeat.
   */
  since: Date;
  /**
   * Whether the agent ended this timer itself — an idle timeout, a sleep,
   * a day boundary, a limit the organisation set — rather than the person
   * pressing stop. Cleared as soon as a timer runs again.
   */
  stoppedByAgent: boolean;
  /**
   * Whether an idle stretch is waiting to be kept or discarded (main holds
   * one on disk for as long as the question is open). Read as late as the
   * caller can: a timeout reached mid-tick must not get a reminder laid
   * over its question. Kept alongside `stoppedByAgent` because it survives
   * a relaunch, where that flag starts again at false.
   */
  awaitingIdleAnswer: boolean;
}

/**
 * Longer than this at a silent machine and nobody is there to read a
 * reminder. Generous on purpose: reading a document is still working,
 * and nudging someone who stepped away for coffee beats missing the one
 * who did not.
 */
export const PRESENCE_IDLE_LIMIT_SECONDS = 10 * 60;

/**
 * Whether the day the reminder talks about is already accounted for. There
 * is no untracked time left to catch once the hours are in — its own second
 * line would read "0 minutes remaining in your work day" — and someone
 * working past them is doing so deliberately. `0` means no day length is
 * configured, so nothing can be full.
 */
export function hasTrackedFullWorkDay(
  trackedTodaySeconds: number,
  workingHoursPerDay: number,
): boolean {
  if (workingHoursPerDay <= 0) return false;
  return trackedTodaySeconds >= workingHoursPerDay * 3600;
}

/**
 * Whether to show a reminder right now. Repeats every `intervalMinutes`
 * while the conditions hold, which is the point: someone who ignores the
 * first nudge and keeps working untracked is exactly who it is for.
 */
export function shouldRemind(input: ReminderInput): boolean {
  const {
    settings,
    now,
    isTracking,
    idleSeconds,
    since,
    stoppedByAgent,
    awaitingIdleAnswer,
  } = input;

  if (!settings) return false;
  if (settings.intervalMinutes <= 0) return false;
  if (isTracking) return false;
  // Only ever about a stop the person chose. A timer the agent stopped has
  // already explained itself where it happened — the idle question, the
  // limit dialog, the idle notice — and saying "you are not tracking"
  // because of something the app did reads as an accusation.
  if (stoppedByAgent) return false;
  if (awaitingIdleAnswer) return false;
  if (idleSeconds > PRESENCE_IDLE_LIMIT_SECONDS) return false;

  const elapsedMinutes = (now.getTime() - since.getTime()) / 60_000;
  return elapsedMinutes >= settings.intervalMinutes;
}
