import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReminderSettings } from './tracking-reminder';

const SETUP_FILE_NAME = 'setup-state.json';

/** What closing the window does, once the person has said "remember my choice". */
export type CloseAction = 'minimize' | 'quit';

/** One-time steps and remembered answers for this install. */
interface SetupState {
  closeAction?: CloseAction;
  waylandScreenshotGranted?: boolean;
  reminderSettings?: ReminderSettings;
  compactAlwaysOnTop?: boolean;
  webAppUrl?: string;
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


/**
 * Whether the one-time Linux/Wayland "Grant Access" portal call (see
 * screenshot-portal.ts) has been approved on this machine. The portal has
 * no query-only API, so this is our own record — kept here rather than in
 * the session because the grant belongs to the machine, not the login.
 */
export function hasWaylandScreenshotGrant(userDataDir: string): boolean {
  return read(userDataDir).waylandScreenshotGranted === true;
}

export function markWaylandScreenshotGranted(userDataDir: string): void {
  write(userDataDir, { ...read(userDataDir), waylandScreenshotGranted: true });
}

/** Kept so a signed-out agent can still nudge: settings arrive over an
 * authenticated poll, and silence is worst on exactly that morning. */
export function cachedReminderSettings(
  userDataDir: string,
): ReminderSettings | null {
  return read(userDataDir).reminderSettings ?? null;
}

export function cacheReminderSettings(
  userDataDir: string,
  settings: ReminderSettings,
): void {
  write(userDataDir, { ...read(userDataDir), reminderSettings: settings });
}

/**
 * Whether the compact bar floats; the smallest view always does. A
 * machine preference, not an account one. Defaults on, because the bar
 * has always floated and dropping that silently would surprise.
 */
export function compactAlwaysOnTop(userDataDir: string): boolean {
  return read(userDataDir).compactAlwaysOnTop !== false;
}

export function setCompactAlwaysOnTop(
  userDataDir: string,
  pinned: boolean,
): void {
  write(userDataDir, { ...read(userDataDir), compactAlwaysOnTop: pinned });
}

function write(userDataDir: string, state: SetupState): void {
  mkdirSync(userDataDir, { recursive: true });
  writeFileSync(filePath(userDataDir), JSON.stringify(state), 'utf-8');
}

/**
 * Where the web app lives, taken from the pairing link the server hands
 * out rather than configured here.
 *
 * The backend builds that link from its own `FRONTEND_URL`, so reading it
 * back is how the tray's dashboard item follows whichever deployment this
 * install actually talks to — a second URL constant beside
 * `api-base-url.ts` would be one more thing to get wrong at release time.
 * Kept with the machine, not the session: the deployment does not change
 * when somebody signs out.
 */
export function webAppOriginFrom(approvalUrl: string): string | null {
  try {
    return new URL(approvalUrl).origin;
  } catch {
    // An older server, or one misconfigured enough to send nonsense. The
    // menu simply does not offer the item.
    return null;
  }
}

export function rememberWebAppUrl(userDataDir: string, approvalUrl: string): void {
  const origin = webAppOriginFrom(approvalUrl);
  if (!origin) return;
  write(userDataDir, { ...read(userDataDir), webAppUrl: origin });
}

/** Null until this install has paired at least once. */
export function cachedWebAppUrl(userDataDir: string): string | null {
  return read(userDataDir).webAppUrl ?? null;
}

/** The remembered answer to the close prompt, or null to ask every time. */
export function rememberedCloseAction(userDataDir: string): CloseAction | null {
  const action = read(userDataDir).closeAction;
  // Anything else (a hand-edited file) means ask, never a silent quit.
  return action === 'minimize' || action === 'quit' ? action : null;
}

/** Remembers `action` for every later close; null goes back to asking. */
export function rememberCloseAction(userDataDir: string, action: CloseAction | null): void {
  const state = read(userDataDir);
  if (action) state.closeAction = action;
  else delete state.closeAction;
  write(userDataDir, state);
}
