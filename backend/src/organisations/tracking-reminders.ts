/**
 * Nudges a member whose agent is open with no timer running — the "I
 * forgot to start it this morning" case.
 *
 * Deliberately has no schedule. Whether someone is *at* their computer
 * beats whether the clock says they ought to be: it stays quiet at a
 * laptop left open over a weekend, and works for anyone whose hours are
 * not nine to five. The agent judges that from idle time; an
 * Organisation sets only how often, and how loudly.
 */
export type TrackingReminderDelivery = 'notification' | 'alert';

export interface TrackingReminderSettings {
  /** Minutes between reminders while the agent is open and untracked.
   * `0` is the off switch, as with screenshot frequency. */
  intervalMinutes: number;
  /** `notification` is a system tray popup; `alert` also raises the app
   * window, which is the point of the feature. */
  delivery: TrackingReminderDelivery;
  /** So the reminder can say how much of the day is left to track. */
  workingHoursPerDay: number;
}

/** Hubstaff's floor, and ours — anything tighter is nagging, not reminding. */
export const MIN_REMINDER_INTERVAL_MINUTES = 5;

/** Off until an admin opts in, like every other capture-adjacent setting. */
export const DEFAULT_REMINDER_INTERVAL_MINUTES = 0;

/**
 * Raising the window is the point — someone who forgot to start their
 * timer has already missed a tray popup once. An admin who wants the
 * quieter option can still pick it.
 */
export const DEFAULT_REMINDER_DELIVERY: TrackingReminderDelivery = 'alert';
