import { describe, expect, it } from 'vitest';
import {
  CHROMIUM_RESTORE_FLAG,
  canRestartSafely,
  firefoxRestoresSession,
  isGeckoBrowser,
  relaunchCommand,
} from '../browser-restart';

describe('firefoxRestoresSession', () => {
  it('is true when the startup page is set to restore the last session', () => {
    expect(
      firefoxRestoresSession(['user_pref("browser.startup.page", 3);']),
    ).toBe(true);
  });

  it('is false for a homepage or blank start', () => {
    expect(firefoxRestoresSession(['user_pref("browser.startup.page", 1);'])).toBe(false);
    expect(firefoxRestoresSession(['user_pref("browser.startup.page", 0);'])).toBe(false);
  });

  // Pessimistic by design: being wrong here costs someone their tabs.
  it('is false when the preference is absent entirely', () => {
    expect(firefoxRestoresSession(['user_pref("browser.search.region", "GB");'])).toBe(
      false,
    );
    expect(firefoxRestoresSession([])).toBe(false);
  });

  it('lets a later file override an earlier one, as Firefox does', () => {
    expect(
      firefoxRestoresSession([
        'user_pref("browser.startup.page", 3);',
        'user_pref("browser.startup.page", 1);',
      ]),
    ).toBe(false);
  });
});

describe('canRestartSafely', () => {
  it('always allows a Chromium browser, which takes the restore flag', () => {
    expect(canRestartSafely('chrome', false).safe).toBe(true);
    expect(canRestartSafely('brave', false).safe).toBe(true);
  });

  it('allows Firefox only when it would reopen its tabs', () => {
    expect(canRestartSafely('firefox', true).safe).toBe(true);
  });

  it('refuses Firefox otherwise, and says which setting to turn on', () => {
    const { safe, reason } = canRestartSafely('firefox', false);

    expect(safe).toBe(false);
    expect(reason).toContain('browser.startup.page');
  });
});

describe('isGeckoBrowser', () => {
  it('recognises Firefox and its forks', () => {
    expect(isGeckoBrowser('firefox')).toBe(true);
    expect(isGeckoBrowser('librewolf')).toBe(true);
  });

  it('does not claim Chromium browsers', () => {
    expect(isGeckoBrowser('chrome')).toBe(false);
    expect(isGeckoBrowser('msedge')).toBe(false);
  });
});

describe('relaunchCommand', () => {
  const activatedExec =
    'env GNOME_ACCESSIBILITY=1 /usr/bin/google-chrome-stable --force-renderer-accessibility=basic %U';

  it('runs the activated Exec, so the browser comes back with a tree', () => {
    const relaunch = relaunchCommand(activatedExec, 'chrome')!;

    expect(relaunch.command).toBe('env');
    expect(relaunch.args).toContain('GNOME_ACCESSIBILITY=1');
    expect(relaunch.args).toContain('--force-renderer-accessibility=basic');
  });

  // %U is a placeholder for files to open; passed through it would be taken
  // as a URL.
  it('drops desktop-entry field codes', () => {
    expect(relaunchCommand(activatedExec, 'chrome')!.args).not.toContain('%U');
  });

  it('adds the restore flag for Chromium', () => {
    expect(relaunchCommand(activatedExec, 'chrome')!.args).toContain(
      CHROMIUM_RESTORE_FLAG,
    );
  });

  it('leaves the restore flag off Firefox, which does not understand it', () => {
    const relaunch = relaunchCommand('/usr/bin/firefox %u', 'firefox')!;

    expect(relaunch.args).not.toContain(CHROMIUM_RESTORE_FLAG);
    expect(relaunch.command).toBe('/usr/bin/firefox');
  });

  it('returns null when there is nothing to run', () => {
    expect(relaunchCommand('', 'chrome')).toBeNull();
  });
});
