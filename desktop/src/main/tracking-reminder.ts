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
}

/**
 * Longer than this at a silent machine and nobody is there to read a
 * reminder. Generous on purpose: reading a document is still working,
 * and nudging someone who stepped away for coffee beats missing the one
 * who did not.
 */
export const PRESENCE_IDLE_LIMIT_SECONDS = 10 * 60;

/**
 * Whether to show a reminder right now. Repeats every `intervalMinutes`
 * while the conditions hold, which is the point: someone who ignores the
 * first nudge and keeps working untracked is exactly who it is for.
 */
export function shouldRemind(input: ReminderInput): boolean {
  const { settings, now, isTracking, idleSeconds, since } = input;

  if (!settings) return false;
  if (settings.intervalMinutes <= 0) return false;
  if (isTracking) return false;
  if (idleSeconds > PRESENCE_IDLE_LIMIT_SECONDS) return false;

  const elapsedMinutes = (now.getTime() - since.getTime()) / 60_000;
  return elapsedMinutes >= settings.intervalMinutes;
}
