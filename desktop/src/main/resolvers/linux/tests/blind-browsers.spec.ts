import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  browserTokens,
  isBrowserProcess,
  readBrowserProcesses,
  selectBlindBrowsers,
  selectRunningBrowsers,
  type BrowserProcess,
} from '../blind-browsers';

const ACTIVATED = '--force-renderer-accessibility=basic';

/** Shapes taken from a real GNOME session — see blind-browsers.ts. */
function chrome(overrides: Partial<BrowserProcess> = {}): BrowserProcess {
  return {
    pid: 5614,
    command: 'chrome',
    executablePath: '/opt/google/chrome/chrome',
    cmdline: ['/opt/google/chrome/chrome'],
    ...overrides,
  };
}

const tokens = browserTokens([
  'google-chrome.desktop',
  'firefox_firefox.desktop',
  'com.microsoft.Edge.desktop',
]);

/**
 * Opera ships `opera_crashreporter` beside `opera`, and the name matches the
 * same token. Counted as a browser it was offered for restart, and a real
 * session reported four browsers open where three were.
 */
describe('helper binaries that share a browser name', () => {
  it("does not take Opera's crash reporter for Opera", () => {
    const reporter = chrome({
      pid: 505066,
      command: 'opera_crashrepo',
      executablePath: '/snap/opera/501/usr/lib/x86_64-linux-gnu/opera/opera_crashreporter',
      cmdline: ['/snap/opera/501/usr/lib/x86_64-linux-gnu/opera/opera_crashreporter'],
    });

    expect(isBrowserProcess(reporter, browserTokens(['opera_opera.desktop']))).toBe(false);
  });

  it('still takes Opera itself for a browser', () => {
    const opera = chrome({
      pid: 504981,
      command: 'opera',
      executablePath: '/snap/opera/501/usr/lib/x86_64-linux-gnu/opera/opera',
      cmdline: ['/snap/opera/501/usr/lib/x86_64-linux-gnu/opera/opera'],
    });

    expect(isBrowserProcess(opera, browserTokens(['opera_opera.desktop']))).toBe(true);
  });
});

/**
 * Seen on a real session: Claude Desktop's native-messaging host, started by
 * Chrome for its extension. Counted as a Chrome with no accessibility flag,
 * it made every machine running it report a blind browser.
 */
describe('extension native-messaging hosts', () => {
  const host = chrome({
    pid: 6886,
    command: 'chrome-native-h',
    executablePath: '/usr/lib/claude-desktop/resources/chrome-native-host',
    cmdline: [
      '/usr/lib/claude-desktop/resources/chrome-native-host',
      'chrome-extension://fcoeoabgfenejglbffodgkkbkcdhcgfn/',
    ],
  });

  it('is never taken for a blind browser', () => {
    expect(selectBlindBrowsers([host], tokens)).toEqual([]);
  });

  it('is dropped on its extension-origin argument even under an unrecognised name', () => {
    const renamed = chrome({
      command: 'chrome-gnome-sh',
      executablePath: '/usr/bin/chrome-gnome-shell',
      cmdline: ['/usr/bin/chrome-gnome-shell', 'chrome-extension://gphhapmejobijbbhgpjhcjognlahblep/'],
    });
    expect(selectBlindBrowsers([renamed], tokens)).toEqual([]);
  });

  it('leaves the blind Chrome beside it reported', () => {
    expect(selectBlindBrowsers([host, chrome()], tokens).map((b) => b.pid)).toEqual([5614]);
  });
});

describe('browserTokens', () => {
  it('keeps the words that name a browser', () => {
    expect(tokens).toContain('chrome');
    expect(tokens).toContain('firefox');
    expect(tokens).toContain('edge');
  });

  // "google" would claim Google Drive; "stable" would claim anything.
  it('drops vendor and packaging words', () => {
    expect(tokens).not.toContain('google');
    expect(tokens).not.toContain('microsoft');
    expect(browserTokens(['vivaldi_vivaldi-stable.desktop'])).not.toContain('stable');
  });
});

describe('isBrowserProcess', () => {
  // The entry runs /usr/bin/google-chrome-stable, a wrapper; the process is
  // /opt/google/chrome/chrome. Matching the entry's name would find nothing.
  it('recognises Chrome despite the launcher being a wrapper', () => {
    expect(isBrowserProcess(chrome(), tokens)).toBe(true);
  });

  it('recognises a snap Firefox, whose path shares nothing with its entry', () => {
    const firefox = chrome({
      command: 'firefox',
      executablePath: '/snap/firefox/6836/usr/lib/firefox/firefox',
    });

    expect(isBrowserProcess(firefox, tokens)).toBe(true);
  });

  // Every Electron app bundles one of these. Claiming them would end an
  // unrelated app's crash handler and open a browser in its place.
  it('does not claim a bundled crash handler, browser or otherwise', () => {
    const chromeHelper = chrome({
      command: 'chrome_crashpad',
      executablePath: '/opt/google/chrome/chrome_crashpad_handler',
    });
    const slackHelper = chrome({
      command: 'chrome_crashpad',
      executablePath: '/usr/lib/slack/chrome_crashpad_handler',
    });

    expect(isBrowserProcess(chromeHelper, tokens)).toBe(false);
    expect(isBrowserProcess(slackHelper, tokens)).toBe(false);
  });

  it('does not claim an unrelated process', () => {
    const editor = chrome({ command: 'code', executablePath: '/usr/share/code/code' });

    expect(isBrowserProcess(editor, tokens)).toBe(false);
  });
});

describe('selectBlindBrowsers', () => {
  it('finds a browser started without the activation flag', () => {
    expect(selectBlindBrowsers([chrome()], tokens)).toEqual([
      { pid: 5614, command: 'chrome', cmdline: ['/opt/google/chrome/chrome'] },
    ]);
  });

  it('ignores one launched through the override', () => {
    const activated = chrome({
      cmdline: ['/opt/google/chrome/chrome', ACTIVATED],
    });

    expect(selectBlindBrowsers([activated], tokens)).toEqual([]);
  });

  // Chromium spawns a renderer per tab. Restarting one would kill a tab,
  // not a browser.
  it('ignores child processes, which carry a type', () => {
    const renderer = chrome({
      pid: 5700,
      cmdline: ['/opt/google/chrome/chrome', '--type=renderer'],
    });

    expect(selectBlindBrowsers([renderer], tokens)).toEqual([]);
  });

  // Gecko forks the same binary for its children and labels them
  // `-contentproc`, not `--type=`. Missing that listed nine Firefox
  // internals as separate browsers needing a restart.
  it("ignores Firefox's own child processes", () => {
    const main = chrome({
      pid: 44670,
      command: 'firefox',
      executablePath: '/snap/firefox/8995/usr/lib/firefox/firefox',
      cmdline: ['/snap/firefox/8995/usr/lib/firefox/firefox', ACTIVATED],
    });
    const children = ['forkserver', 'Isolated Web Co', 'Privileged Cont'].map(
      (command, index) =>
        chrome({
          pid: 44900 + index,
          command,
          executablePath: '/snap/firefox/8995/usr/lib/firefox/firefox',
          cmdline: [
            '/snap/firefox/8995/usr/lib/firefox/firefox',
            '-contentproc',
            '-childID',
            String(index),
          ],
        }),
    );

    expect(selectBlindBrowsers([main, ...children], tokens)).toEqual([]);
  });

  // Chrome rewrites its own argv, so /proc hands back one space-separated
  // blob rather than separate arguments. Read naively, every Chrome process
  // looked blind.
  it('reads flags out of a single space-separated command line', () => {
    const activatedBlob = chrome({
      cmdline: ['/opt/google/chrome/chrome', ACTIVATED],
    });
    const rendererBlob = chrome({
      pid: 5811,
      cmdline: ['/opt/google/chrome/chrome', '--type=renderer', '--enable-crash-reporter=x'],
    });

    expect(selectBlindBrowsers([activatedBlob, rendererBlob], tokens)).toEqual([]);
  });

  it('ignores everything that is not a browser', () => {
    const editor = chrome({ command: 'code', executablePath: '/usr/share/code/code' });

    expect(selectBlindBrowsers([editor], tokens)).toEqual([]);
  });
});

describe('selectRunningBrowsers', () => {
  // The two sets answer different questions, and this is the case that
  // separates them: a browser started with accessibility already active is
  // tracked fine, so it is never blind — but shadowing its launcher still
  // orphaned its windows, and only a restart reseats them.
  it('includes an activated browser that selectBlindBrowsers excludes', () => {
    const activated = chrome({ cmdline: ['/opt/google/chrome/chrome', ACTIVATED] });

    expect(selectBlindBrowsers([activated], tokens)).toEqual([]);
    expect(selectRunningBrowsers([activated], tokens)).toEqual([
      {
        pid: 5614,
        command: 'chrome',
        cmdline: ['/opt/google/chrome/chrome', ACTIVATED],
      },
    ]);
  });

  it('still drops helper processes, so one browser is one entry', () => {
    const main = chrome();
    const renderer = chrome({
      pid: 5700,
      cmdline: ['/opt/google/chrome/chrome', '--type=renderer'],
    });

    expect(selectRunningBrowsers([main, renderer], tokens)).toEqual([
      { pid: 5614, command: 'chrome', cmdline: ['/opt/google/chrome/chrome'] },
    ]);
  });

  it('never claims a non-browser', () => {
    const editor = chrome({
      pid: 900,
      command: 'gedit',
      executablePath: '/usr/bin/gedit',
      cmdline: ['/usr/bin/gedit'],
    });

    expect(selectRunningBrowsers([editor], tokens)).toEqual([]);
  });
});

/**
 * A production GNOME session reported Avahi-daemon, Dbus-daemon,
 * Accounts-daemon, Rtkit-daemon, Ibus-daemon, Goa-daemon, Gnome-remote-de
 * and Gnome-keyring-d as "running without website tracking" — every process
 * on the machine whose name contains `daemon`. One `.desktop` file named
 * after a background process is all it takes: its filename contributes
 * `daemon` as a token, and the token match is a bare substring test.
 *
 * (The two truncated names are the kernel's: `comm` stops at 15 characters.)
 */
describe('system daemons are not browsers', () => {
  /** Shapes and owners read off a real GNOME 46 session. */
  const daemons: { comm: string; exe: string }[] = [
    { comm: 'avahi-daemon', exe: 'avahi-daemon:' },
    { comm: 'dbus-daemon', exe: '/usr/bin/dbus-daemon' },
    { comm: 'accounts-daemon', exe: '/usr/libexec/accounts-daemon' },
    { comm: 'rtkit-daemon', exe: '/usr/libexec/rtkit-daemon' },
    { comm: 'ibus-daemon', exe: '/usr/bin/ibus-daemon' },
    { comm: 'goa-daemon', exe: '/usr/libexec/goa-daemon' },
    { comm: 'gnome-remote-de', exe: '/usr/libexec/gnome-remote-desktop-daemon' },
    { comm: 'gnome-keyring-d', exe: '/usr/bin/gnome-keyring-daemon' },
  ];

  /** The entry that poisoned the token list on the affected machine. */
  const poisoned = browserTokens([
    'google-chrome.desktop',
    'firefox_firefox.desktop',
    'com.microsoft.Edge.desktop',
    'some-sync-daemon.desktop',
  ]);

  it('never lets a word every background process shares become a token', () => {
    expect(poisoned).not.toContain('daemon');
  });

  it.each(daemons)('does not take $comm for a browser', ({ comm, exe }) => {
    const process = chrome({ command: comm, executablePath: exe, cmdline: [exe] });
    expect(isBrowserProcess(process, poisoned)).toBe(false);
    expect(isBrowserProcess(process, [...poisoned, 'daemon'])).toBe(false);
  });

  it('reports none of them as blind, which is what reached the Devices page', () => {
    const processes = daemons.map(({ comm, exe }) =>
      chrome({ command: comm, executablePath: exe, cmdline: [exe] }),
    );
    expect(selectBlindBrowsers(processes, [...poisoned, 'daemon'])).toEqual([]);
  });
});

/** The gates above must not cost a single browser anyone actually uses. */
describe('real browsers still match', () => {
  const tokensFromRealEntries = browserTokens([
    'google-chrome.desktop',
    'firefox_firefox.desktop',
    'com.microsoft.Edge.desktop',
    'microsoft-edge.desktop',
    'brave_brave.desktop',
    'opera_opera.desktop',
    'vivaldi_vivaldi-stable.desktop',
    'chromium_chromium.desktop',
  ]);

  it.each([
    ['chrome', '/opt/google/chrome/chrome'],
    ['chrome', '/usr/bin/google-chrome-stable'],
    ['firefox', '/usr/lib/firefox/firefox'],
    ['firefox', '/snap/firefox/current/usr/lib/firefox/firefox'],
    // Edge's binary is `msedge`, which only a substring match reaches —
    // the reason this stayed a substring test rather than becoming exact.
    ['msedge', '/opt/microsoft/msedge/msedge'],
    ['brave', '/opt/brave.com/brave/brave'],
    ['opera', '/usr/lib/x86_64-linux-gnu/opera/opera'],
    ['vivaldi-bin', '/opt/vivaldi/vivaldi-bin'],
    ['chromium', '/usr/lib/chromium/chromium'],
  ])('still recognises %s at %s', (command, executablePath) => {
    expect(
      isBrowserProcess(chrome({ command, executablePath, cmdline: [executablePath] }), tokensFromRealEntries),
    ).toBe(true);
  });
});

describe('only this user’s processes', () => {
  let procRoot: string;

  beforeEach(() => {
    procRoot = mkdtempSync(join(tmpdir(), 'proc-'));
    mkdirSync(join(procRoot, '4242'));
    writeFileSync(join(procRoot, '4242', 'comm'), 'avahi-daemon\n');
    writeFileSync(join(procRoot, '4242', 'cmdline'), 'avahi-daemon:\0running\0');
  });
  afterEach(() => rmSync(procRoot, { recursive: true, force: true }));

  it('reads a process this user owns', () => {
    const own = process.getuid?.() ?? -1;
    expect(readBrowserProcesses(procRoot, own)).toHaveLength(1);
  });

  it('skips one owned by root or a system user', () => {
    // The scan read all of /proc despite its own doc comment; nobody opens
    // a browser as `avahi`.
    const someoneElse = (process.getuid?.() ?? 0) + 1;
    expect(readBrowserProcesses(procRoot, someoneElse)).toEqual([]);
  });

  it('reads everything where there is no uid to compare against', () => {
    expect(readBrowserProcesses(procRoot, -1)).toHaveLength(1);
  });
});
