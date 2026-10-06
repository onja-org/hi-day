import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SETUP_FILE_NAME = 'setup-state.json';

/** One-time steps this install has already been through. */
interface SetupState {
  browserRestartPromptSeen?: boolean;
}

/**
 * Deliberately its own file rather than a field on the stored session:
 * logging out calls `AuthStore.clear()`, which deletes `session.dat`
 * outright, and a flag kept there would bring the first-run screen back on
 * every re-login. This survives logout, re-pairing and an update installed
 * over the top — only wiping the app's data clears it.
 */
function filePath(userDataDir: string): string {
  return join(userDataDir, SETUP_FILE_NAME);
}

function read(userDataDir: string): SetupState {
  const path = filePath(userDataDir);
  if (!existsSync(path)) return {};

  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SetupState;
  } catch {
    // A truncated or hand-edited file reads as "nothing done yet". Showing
    // a one-time screen a second time is a far smaller cost than throwing
    // on startup, which would leave the app with no window at all.
    return {};
  }
}

/** Whether the first-run browser-restart screen has already had its turn. */
export function hasSeenBrowserRestartPrompt(userDataDir: string): boolean {
  return read(userDataDir).browserRestartPromptSeen === true;
}

/**
 * Records that the screen has been shown and acted on, so it never appears
 * again. Written even when the restart itself failed: the person has given
 * their answer, and re-asking on the next launch is not what they agreed to.
 */
export function markBrowserRestartPromptSeen(userDataDir: string): void {
  mkdirSync(userDataDir, { recursive: true });
  writeFileSync(
    filePath(userDataDir),
    JSON.stringify({ ...read(userDataDir), browserRestartPromptSeen: true }),
    'utf-8',
  );
}
