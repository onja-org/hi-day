import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What a session ending takes with it is a decision, not an implementation
 * detail — and `main.ts` has no seam to unit-test it through, so a decision
 * made here is one the next change can quietly reverse with every test
 * still green. That is how it was reversed once already: a remote sign-out
 * deleted the hours somebody had worked offline, and nothing noticed.
 *
 * Reads the source as text, in the same spirit as
 * `renderer-markup-contract.spec.ts`.
 */
const MAIN = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8');

/** The body of a top-level function inside `registerIpcHandlers`. */
function bodyOf(declaration: string): string {
  const start = MAIN.indexOf(declaration);
  // A rename must fail loudly here rather than pass an empty body.
  expect(start, `${declaration} — not found; was it renamed?`).toBeGreaterThan(-1);
  const end = MAIN.indexOf('\n  }', start);
  expect(end).toBeGreaterThan(start);
  return MAIN.slice(start, end);
}

describe('what an ended session takes with it', () => {
  it('never deletes the queued hours', () => {
    // They are pay. Each one carries its owner, so the person who worked
    // them replays them at their next login and anybody else logging in
    // deletes them — keeping them cannot reach the wrong timesheet.
    const body = bodyOf('function discardEndedSessionCaptures()');
    expect(body).toContain('offlineQueue.discardAll()');
    expect(body).not.toContain('pendingOps.discardAll');
  });

  it('still deletes the captures, on a remote sign-out as well as a logout', () => {
    // A screenshot and a browsing history belong to the session that took
    // them; leaving those on a shared machine is a disclosure.
    expect(bodyOf('function signOutLocally()')).toContain(
      'discardEndedSessionCaptures()',
    );
    expect(bodyOf('ipcMain.handle("auth:logout"')).toContain(
      'discardEndedSessionCaptures()',
    );
  });

  it('tries to send the queued hours before the token dies', () => {
    // Kept is not the same as sent: this is the last moment the token
    // works, so the person need not wait for their next login.
    const body = bodyOf('async function sendBacklogBeforeLogout()');
    expect(body).toContain('pendingOps.load().length');
    expect(body).toContain('flushPendingOps()');
  });
});
