import { intervalFromEnv } from './tuning';

/**
 * How long out of touch, with data waiting, before the agent says so.
 *
 * Not immediately: a dropped connection is ordinary and the queue exists
 * so it costs nothing, and a banner people see several times a day is one
 * they learn to ignore. Five minutes is ~50 failed requests across four
 * loops — above the length of a backend deploy, which would otherwise
 * alarm everybody at once, and below the point where it reports a problem
 * somebody has already been living with. Three to ten is all defensible;
 * only watching how often it fires can settle it, hence the override.
 */
export const BACKLOG_WARNING_AFTER_MS = intervalFromEnv(
  'WM_BACKLOG_WARNING_MS',
  5 * 60 * 1000,
);

export interface SyncBacklog {
  /** Queued app events, screenshots, activity samples, URL sessions and timer ops. */
  hasUnsent: boolean;
  /** Time since the server last answered, or null if it never has. */
  silentForMs: number | null;
}

/**
 * Whether to tell the person their tracked data may not be fully synced.
 *
 * Needs both halves. Offline with nothing waiting is not a problem to
 * report — the agent works offline by design — and a queue draining
 * normally is not a backlog. `silentForMs` null means the server has
 * never answered, which cannot happen with data waiting, since pairing is
 * itself a successful request.
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
 * Leads with the reassurance deliberately: "your data may not be synced"
 * alone reads as "your hours are gone", and somebody who believes that
 * starts keeping their time somewhere else.
 */
export const BACKLOG_MESSAGE =
  "Your tracked time and activity haven't been uploaded yet. Nothing is " +
  'lost — it is saved on this computer and will upload once Hi Day can be ' +
  'reached. Check your internet connection, and restart Hi Day if this ' +
  'message stays.';
