import { describe, expect, it } from 'vitest';
import {
  CHROMIUM_RESTORE_FLAG,
  restartWarning,
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

describe('restartWarning', () => {
  // Chromium reopens its session from the flag whatever the person's
  // settings, so there is nothing to warn about.
  it('says nothing for a Chromium browser', () => {
    expect(restartWarning('chrome', false)).toBeNull();
    expect(restartWarning('brave', false)).toBeNull();
  });

  it('says nothing for a Firefox already set to restore', () => {
    expect(restartWarning('firefox', true)).toBeNull();
  });

  // Restarted anyway, but the tabs need a manual step, so point at it rather
  // than let them look lost.
  it('points at manual restore for a Firefox that would not reopen tabs', () => {
    const warning = restartWarning('firefox', false);

    expect(warning).toContain('Restore Previous Session');
    // Capitalised at the source, so every sentence naming a browser agrees.
    expect(warning).toContain('Firefox');
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

  /**
   * Flatpak refuses to start on an option it does not know, so anything for
   * the browser has to sit *after* the app id — the reason
   * `activateFlatpakExec` exists. The restore flag has to land there too.
   */
  it('puts the restore flag after a flatpak app id, not before it', () => {
    const activated =
      '/usr/bin/flatpak run --env=GNOME_ACCESSIBILITY=1 --branch=stable com.opera.Opera --force-renderer-accessibility=basic %U';
    const { args } = relaunchCommand(activated, 'opera')!;
    const appId = args.indexOf('com.opera.Opera');

    expect(appId).toBeGreaterThan(-1);
    expect(args.indexOf(CHROMIUM_RESTORE_FLAG)).toBeGreaterThan(appId);
    expect(args.findIndex((arg) => arg.startsWith('--env='))).toBeLessThan(appId);
  });

  // Flatpak's file-forwarding markers would otherwise reach the browser as
  // literal arguments.
  it("drops flatpak's @@ placeholders", () => {
    const { args } = relaunchCommand(
      '/usr/bin/flatpak run org.mozilla.firefox @@u %u @@',
      'firefox',
    )!;

    expect(args).not.toContain('@@');
    expect(args).not.toContain('@@u');
  });

  it('returns null when there is nothing to run', () => {
    expect(relaunchCommand('', 'chrome')).toBeNull();
  });
});
