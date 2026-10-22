/**
 * How long the agent will be out of touch, with data waiting, before it
 * says so.
 *
 * Not immediately, on purpose. A dropped connection is ordinary and the
 * queue exists precisely so it costs nothing: warning the moment a single
 * screenshot fails to upload would put a worrying banner on screen
 * several times a day for something that fixes itself in seconds, and a
 * warning people learn to ignore is worse than none. Five minutes is long
 * enough that the queue has genuinely stopped draining rather than
 * hiccuped, and short enough to reach somebody while they can still do
 * something about it.
 */
export const BACKLOG_WARNING_AFTER_MS = 5 * 60 * 1000;

export interface SyncBacklog {
  /**
   * Anything captured or clicked that the server has not accepted yet —
   * queued app events, screenshots, activity samples, URL sessions, and
   * timer starts and stops waiting to be replayed.
   */
  hasUnsent: boolean;
  /** How long since the server last answered, or null if it never has. */
  silentForMs: number | null;
}

/**
 * Whether to tell the person their tracked data may not be fully synced.
 *
 * Deliberately needs *both* halves. Being offline with nothing waiting is
 * not a problem to report — the agent works offline by design, and saying
 * "your data may not be synced" when all of it is would be a lie that
 * teaches people to distrust the banner. Equally, a queue with items in
 * it is normal while the server is answering: they are drained on a timer,
 * and a batch mid-flight is not a backlog.
 *
 * `silentForMs` of null means the server has never answered this install.
 * Treated as "say nothing": in practice it cannot happen with data
 * waiting, since pairing is itself a successful request, and inventing a
 * duration to compare against would be guessing.
 */
export function shouldWarnAboutBacklog(
  backlog: SyncBacklog,
  afterMs: number = BACKLOG_WARNING_AFTER_MS,
): boolean {
  if (!backlog.hasUnsent) return false;
  if (backlog.silentForMs === null) return false;
  return backlog.silentForMs >= afterMs;
}

/**
 * What the person is told. Three things, in the order they need them:
 * that it has not been uploaded, that it is not lost, and what to try.
 *
 * The reassurance is the part that cannot be dropped. "Your data may not
 * be synced" on its own reads as "your hours are gone", and somebody who
 * believes that will start writing their time down somewhere else — or
 * worse, stop trusting the app with it at all. The data is on their disk
 * and will go up on its own; the banner exists so a queue that has
 * genuinely stuck is noticed, not so that an outage feels like a loss.
 */
export const BACKLOG_MESSAGE =
  "Your tracked time and activity haven't been uploaded yet. Nothing is " +
  'lost — it is saved on this computer and will upload once Hi Day can be ' +
  'reached. Check your internet connection, and restart Hi Day if this ' +
  'message stays.';
