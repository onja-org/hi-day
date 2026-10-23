/**
 * An idle stretch the timer has been stopped for, waiting to be settled.
 *
 * Tracking stops at the moment input stopped (`idleStartedAt`) — reached
 * either by sitting idle past the organisation's timeout while the app
 * watched, or by the machine going to sleep — and what happens next depends
 * on how long the person was away:
 *
 * - Back before the timeout (only possible across a sleep): tracking picks
 *   up from `idleStartedAt` as if it had never stopped.
 * - Past it: the person is asked. Keep starts again from `idleStartedAt`, so
 *   the idle stretch counts; Discard starts from when they came back, so it
 *   does not — and nor is the work they did between coming back and
 *   answering lost.
 *
 * Stopping rather than leaving the timer running means a question nobody
 * answers (a laptop closed overnight) never runs up hours on its own. Each
 * outcome restarts the timer, so the stretch before and after the idle time
 * becomes two back-to-back entries, as a pause and resume already does.
 *
 * Mirrors main's `IdleHold` (src/main/idle-hold-store.ts), which keeps it on
 * disk so a reload, a relaunch or a crash does not lose the question.
 */
export interface IdleHold {
  projectId: string | null;
  taskId: string | null;
  /** When input stopped — the entry was ended here. */
  idleStartedAt: string;
  /** When the person came back: input resumed, or the machine woke. Null while still away. */
  returnedAt: string | null;
  reason: "timeout" | "sleep";
}

export interface IdleHoldPolicy {
  handling: "off" | "flag" | "auto_subtract";
  thresholdMinutes: number;
}

export type ReturnDecision =
  /** Back before the timeout: carry on from `startedAt`, no question asked. */
  | { kind: "resume"; startedAt: string }
  /** Past the timeout: show the Keep/Discard prompt. */
  | { kind: "ask" }
  /** Past the timeout with `auto_subtract`: the idle time is dropped, and the timer stays stopped. */
  | { kind: "stay-stopped" };

/** How long the person was away, in whole seconds — up to `nowMs` while they still are. */
export function awaySeconds(hold: IdleHold, nowMs: number): number {
  const endMs = hold.returnedAt ? Date.parse(hold.returnedAt) : nowMs;
  return Math.max(0, Math.floor((endMs - Date.parse(hold.idleStartedAt)) / 1000));
}

/**
 * What to do once the person is back. A hold made at the timeout has, by
 * definition, already reached it; a sleep one is judged on the whole
 * stretch, from the last input before the machine slept to when it woke.
 */
export function decideOnReturn(
  hold: IdleHold,
  policy: IdleHoldPolicy,
  nowMs: number,
): ReturnDecision {
  const reachedTimeout =
    hold.reason === "timeout" ||
    awaySeconds(hold, nowMs) >= policy.thresholdMinutes * 60;
  if (!reachedTimeout) return { kind: "resume", startedAt: hold.idleStartedAt };
  return policy.handling === "auto_subtract" ? { kind: "stay-stopped" } : { kind: "ask" };
}

/** Keep: the idle stretch counts, so the timer starts again from where it stopped. */
export function keepStartedAt(hold: IdleHold): string {
  return hold.idleStartedAt;
}

/** Discard: only the idle stretch is dropped — the timer starts again from when they came back. */
export function discardStartedAt(hold: IdleHold, nowIso: string): string {
  return hold.returnedAt ?? nowIso;
}
