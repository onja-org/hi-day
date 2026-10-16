import { describe, expect, it } from 'vitest';
import {
  CHROMIUM_RESTORE_FLAG,
  restartWarning,
  firefoxRestoresSession,
  isGeckoBrowser,
  geckoProfileArguments,
  relaunchCommand,
  relaunchCommands,
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

  // Taken from the real snap-packaged Vivaldi entry. These tokens become an
  // argv with no shell in between, so a surviving quote is part of the
  // argument — Chromium read `'--class=Vivaldi-snap'` as something to open
  // instead of as a flag, dropping the class and opening a tab for the junk
  // string on every restart. Confirmed against a live spawn before fixing.
  it("strips the single quotes a vendor entry uses, not just the spec's double ones", () => {
    const { args } = relaunchCommand(
      "env GNOME_ACCESSIBILITY=1 /snap/bin/vivaldi --force-renderer-accessibility=basic '--class=Vivaldi-snap' %U",
      'vivaldi',
    )!;

    expect(args).toContain('--class=Vivaldi-snap');
    expect(args).not.toContain("'--class=Vivaldi-snap'");
  });

  it('still strips the double quotes the spec does define', () => {
    const { args } = relaunchCommand(
      '/usr/bin/chrome "--user-data-dir=/home/a b/profile" %U',
      'chrome',
    )!;

    expect(args).toContain('--user-data-dir=/home/a b/profile');
  });

  // Only matched pairs: an apostrophe inside an argument is part of it, and
  // stripping a lone quote would corrupt a path rather than clean it.
  it("leaves an unmatched quote alone", () => {
    const { args } = relaunchCommand(
      "/usr/bin/chrome --profile=/home/o'brien/data %U",
      'chrome',
    )!;

    expect(args).toContain("--profile=/home/o'brien/data");
  });

  it('returns null when there is nothing to run', () => {
    expect(relaunchCommand('', 'chrome')).toBeNull();
  });
});

describe('geckoProfileArguments', () => {
  it("keeps a Firefox window's named profile, which uses its own flag", () => {
    expect(
      geckoProfileArguments(['/snap/firefox/firefox', '-P', 'personal']),
    ).toEqual(['--profile', 'personal']);
  });

  it('has nothing to carry for a default-profile window', () => {
    expect(geckoProfileArguments(['/snap/firefox/firefox'])).toEqual([]);
  });
});

describe('relaunchCommands', () => {
  const activatedExec =
    'env GNOME_ACCESSIBILITY=1 /usr/bin/google-chrome-stable --force-renderer-accessibility=basic %U';

  /**
   * The reported case: two Chrome windows on different profiles. Chromium
   * runs both inside one process and names neither in its argv, so a single
   * relaunch reopened one and showed the profile picker for the rest.
   */
  it('launches once per open profile, each one named', () => {
    const commands = relaunchCommands(activatedExec, 'chrome', [], {
      userDataDir: '/home/sam/.config/google-chrome',
      profiles: ['Default', 'Profile 3'],
    });

    expect(commands.map((entry) => entry.args.at(-1))).toEqual([
      '--profile-directory=Default',
      '--profile-directory=Profile 3',
    ]);
    // Still activated, and still restoring each profile's own session.
    for (const { args } of commands) {
      expect(args).toContain('--force-renderer-accessibility=basic');
      expect(args).toContain(CHROMIUM_RESTORE_FLAG);
    }
  });

  it('carries a user-data-dir only when they chose one themselves', () => {
    const open = { userDataDir: '/tmp/work', profiles: ['Default'] };

    expect(relaunchCommands(activatedExec, 'chrome', [], open)[0].args).not.toContain(
      '--user-data-dir=/tmp/work',
    );
    expect(
      relaunchCommands(activatedExec, 'chrome', ['--user-data-dir=/tmp/work'], open)[0]
        .args,
    ).toContain('--user-data-dir=/tmp/work');
  });

  it('falls back to a single plain launch when no profile is known', () => {
    expect(relaunchCommands(activatedExec, 'chrome')).toHaveLength(1);
  });

  it('leaves Firefox a single launch, since its profiles are separate processes', () => {
    const commands = relaunchCommands('/usr/bin/firefox %u', 'firefox', [], {
      userDataDir: null,
      profiles: ['Default', 'Profile 3'],
    });

    expect(commands).toHaveLength(1);
    expect(commands[0].args).not.toContain('--profile-directory=Default');
  });
});
