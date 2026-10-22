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
      // The link is to /link-device with a code on it; the dashboard is
      // the site, not that page.
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
