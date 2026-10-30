import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cacheReminderSettings,
  cachedWebAppUrl,
  rememberWebAppUrl,
  webAppOriginFrom,
  compactAlwaysOnTop,
  setCompactAlwaysOnTop,
  cachedReminderSettings,
  hasWaylandScreenshotGrant,
  markWaylandScreenshotGranted,
  rememberCloseAction,
  rememberedCloseAction,
  autoStartTimer,
  setAutoStartTimer,
  lastAutoStartedBoot,
  lastAutoStartedDay,
  rememberAutoStarted,
} from '../setup-state';
import type { ReminderSettings } from '../tracking-reminder';

describe('setup state', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-setup-state-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('remembers one answer without losing another', () => {
    expect(hasWaylandScreenshotGrant(userDataDir)).toBe(false);
    rememberCloseAction(userDataDir, 'minimize');

    markWaylandScreenshotGranted(userDataDir);

    expect(hasWaylandScreenshotGrant(userDataDir)).toBe(true);
    expect(rememberedCloseAction(userDataDir)).toBe('minimize');
  });

  it('has granted nothing on a fresh install', () => {
    expect(hasWaylandScreenshotGrant(userDataDir)).toBe(false);
  });

  it('creates the directory when it does not exist yet', () => {
    const nested = join(userDataDir, 'does', 'not', 'exist');

    markWaylandScreenshotGranted(nested);

    expect(hasWaylandScreenshotGrant(nested)).toBe(true);
  });


  /**
   * Read as text because the guarantee is the absence of a call, which no
   * amount of exercising the module can demonstrate. An update rewrites the
   * launcher files, and clearing on that is what handed the question back.
   */
  it('has nothing anywhere that clears it', () => {
    const main = readFileSync(join(__dirname, '../main.ts'), 'utf-8');
    const store = readFileSync(join(__dirname, '../setup-state.ts'), 'utf-8');

    expect(main).not.toContain('clearBrowserRestartPromptSeen');
    expect(store).not.toContain('clearBrowserRestartPromptSeen');
  });
});

describe('starting the timer when the machine comes on', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-auto-start-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('is on on a fresh install', () => {
    expect(autoStartTimer(userDataDir)).toBe(true);
  });

  it('remembers being turned off, and on again', () => {
    setAutoStartTimer(userDataDir, false);
    expect(autoStartTimer(userDataDir)).toBe(false);

    setAutoStartTimer(userDataDir, true);
    expect(autoStartTimer(userDataDir)).toBe(true);
  });

  it('has started for no power-on or day yet', () => {
    expect(lastAutoStartedBoot(userDataDir)).toBeNull();
    expect(lastAutoStartedDay(userDataDir)).toBeNull();
  });

  it('remembers the power-on and day it started for, and replaces both', () => {
    rememberAutoStarted(userDataDir, 'id:first', '2026-10-28');
    expect(lastAutoStartedBoot(userDataDir)).toBe('id:first');
    expect(lastAutoStartedDay(userDataDir)).toBe('2026-10-28');

    rememberAutoStarted(userDataDir, 'id:second', '2026-10-29');
    expect(lastAutoStartedBoot(userDataDir)).toBe('id:second');
    expect(lastAutoStartedDay(userDataDir)).toBe('2026-10-29');
  });

  // The day still has to land, or every launch would read as a new day.
  it('keeps the remembered power-on when this machine has none to give', () => {
    rememberAutoStarted(userDataDir, 'id:first', '2026-10-28');
    rememberAutoStarted(userDataDir, null, '2026-10-29');

    expect(lastAutoStartedDay(userDataDir)).toBe('2026-10-29');
    expect(lastAutoStartedBoot(userDataDir)).toBe('id:first');
  });

  // Both live in the one file every other preference does, so writing
  // either must leave the rest of it alone.
  it('keeps the other preferences while it writes its own', () => {
    setCompactAlwaysOnTop(userDataDir, false);
    rememberCloseAction(userDataDir, 'quit');

    setAutoStartTimer(userDataDir, false);
    rememberAutoStarted(userDataDir, 'id:abc', '2026-10-29');

    expect(compactAlwaysOnTop(userDataDir)).toBe(false);
    expect(rememberedCloseAction(userDataDir)).toBe('quit');
    expect(autoStartTimer(userDataDir)).toBe(false);
    expect(lastAutoStartedBoot(userDataDir)).toBe('id:abc');
  });

  // Signing out deletes the session, never this file: the laptop is still
  // the laptop somebody works on. An upgrade from a build predating the
  // preference therefore lands on the default, which is on.
  it('survives a file written by a build that knew nothing about it', () => {
    writeFileSync(
      join(userDataDir, 'setup-state.json'),
      JSON.stringify({ compactAlwaysOnTop: true }),
      'utf-8',
    );

    expect(autoStartTimer(userDataDir)).toBe(true);
    expect(lastAutoStartedBoot(userDataDir)).toBeNull();
  });
});

describe('remembered close action', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-close-action-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('asks on a fresh install', () => {
    expect(rememberedCloseAction(userDataDir)).toBeNull();
  });

  it('remembers the chosen action', () => {
    rememberCloseAction(userDataDir, 'quit');

    expect(rememberedCloseAction(userDataDir)).toBe('quit');
  });

  it('goes back to asking when cleared', () => {
    rememberCloseAction(userDataDir, 'minimize');
    rememberCloseAction(userDataDir, null);

    expect(rememberedCloseAction(userDataDir)).toBeNull();
  });

  // Both live in one file, so neither write may drop the other.
  it('keeps the Wayland grant alongside it', () => {
    markWaylandScreenshotGranted(userDataDir);
    rememberCloseAction(userDataDir, 'minimize');
    rememberCloseAction(userDataDir, null);

    expect(hasWaylandScreenshotGrant(userDataDir)).toBe(true);
  });

  it('asks rather than quitting silently on an unrecognised value', () => {
    writeFileSync(join(userDataDir, 'setup-state.json'), JSON.stringify({ closeAction: 'explode' }));

    expect(rememberedCloseAction(userDataDir)).toBeNull();
  });
});

describe('cached reminder settings', () => {
  const SETTINGS: ReminderSettings = {
    intervalMinutes: 10,
    delivery: 'alert',
    workingHoursPerDay: 8,
  };

  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-reminder-cache-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('has nothing to offer before the first poll', () => {
    expect(cachedReminderSettings(userDataDir)).toBeNull();
  });

  it('reads back whole, so a signed-out agent still knows the shift', () => {
    cacheReminderSettings(userDataDir, SETTINGS);

    expect(cachedReminderSettings(userDataDir)).toEqual(SETTINGS);
  });

  it('leaves the other remembered answers alone', () => {
    rememberCloseAction(userDataDir, 'minimize');
    cacheReminderSettings(userDataDir, SETTINGS);

    expect(rememberedCloseAction(userDataDir)).toBe('minimize');
    expect(cachedReminderSettings(userDataDir)).toEqual(SETTINGS);
  });

  it('reads a hand-broken file as "nothing cached" rather than throwing', () => {
    writeFileSync(join(userDataDir, 'setup-state.json'), '{ not json', 'utf-8');

    expect(cachedReminderSettings(userDataDir)).toBeNull();
  });
});

describe('compact always on top', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-compact-pin-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('floats by default, since the bar always has', () => {
    expect(compactAlwaysOnTop(userDataDir)).toBe(true);
  });

  it('stays off once someone turns it off', () => {
    setCompactAlwaysOnTop(userDataDir, false);

    expect(compactAlwaysOnTop(userDataDir)).toBe(false);
  });

  it('can be turned back on', () => {
    setCompactAlwaysOnTop(userDataDir, false);
    setCompactAlwaysOnTop(userDataDir, true);

    expect(compactAlwaysOnTop(userDataDir)).toBe(true);
  });

  it('leaves the other remembered answers alone', () => {
    rememberCloseAction(userDataDir, 'quit');
    setCompactAlwaysOnTop(userDataDir, false);

    expect(rememberedCloseAction(userDataDir)).toBe('quit');
  });

  describe('where the web app lives', () => {
    it('knows nothing until this install has paired', () => {
      expect(cachedWebAppUrl(userDataDir)).toBeNull();
    });

    it('takes the origin from the pairing link, dropping its path', () => {
      rememberWebAppUrl(userDataDir, 'https://app.hiday.io/link-device?code=abc');

      expect(cachedWebAppUrl(userDataDir)).toBe('https://app.hiday.io');
    });

    it('follows whichever deployment this install talks to', () => {
      rememberWebAppUrl(userDataDir, 'http://localhost:3000/link-device?code=x');

      expect(cachedWebAppUrl(userDataDir)).toBe('http://localhost:3000');
    });

    it('keeps the last good one when a later link is unusable', () => {
      rememberWebAppUrl(userDataDir, 'https://app.hiday.io/link-device?code=a');

      rememberWebAppUrl(userDataDir, 'not-a-url');

      expect(cachedWebAppUrl(userDataDir)).toBe('https://app.hiday.io');
    });

    it('reads an unusable link as nothing rather than throwing', () => {
      expect(webAppOriginFrom('not-a-url')).toBeNull();
    });

    it('survives a sign-out, since the deployment did not change', () => {
      rememberWebAppUrl(userDataDir, 'https://app.hiday.io/link-device?code=a');
      rememberCloseAction(userDataDir, 'minimize');

      expect(cachedWebAppUrl(userDataDir)).toBe('https://app.hiday.io');
      expect(rememberedCloseAction(userDataDir)).toBe('minimize');
    });
  });
});
