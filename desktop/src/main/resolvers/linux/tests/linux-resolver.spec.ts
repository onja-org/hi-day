import { describe, expect, it } from 'vitest';
import { ADDRESS_BAR_ROLES, MAX_SEARCH_DEPTH, hasReadableAddressBarText } from '../atspi';
import { hwndFromPath, normalizeAppName, pidFromBusName } from '../index';
import { evaluateSupport, readSessionEnvironment } from '../support-gate';

describe('evaluateSupport — Step 20 support matrix', () => {
  it('enables GNOME on Wayland', () => {
    const verdict = evaluateSupport({ sessionType: 'wayland', currentDesktop: 'ubuntu:GNOME' });
    expect(verdict.supported).toBe(true);
    expect(verdict.sessionType).toBe('wayland');
  });

  it('enables any window manager on Xorg', () => {
    const verdict = evaluateSupport({ sessionType: 'x11', currentDesktop: 'KDE' });
    expect(verdict.supported).toBe(true);
    expect(verdict.sessionType).toBe('x11');
  });

  it('disables non-GNOME Wayland, naming Xorg as the way to enable it', () => {
    const verdict = evaluateSupport({ sessionType: 'wayland', currentDesktop: 'KDE' });
    expect(verdict.supported).toBe(false);
    expect(verdict.reason).toContain('Xorg');
  });

  it('disables an undeterminable session rather than guessing', () => {
    const verdict = evaluateSupport({ sessionType: undefined, currentDesktop: undefined });
    expect(verdict.supported).toBe(false);
    expect(verdict.sessionType).toBe('unknown');
  });

  it('matches GNOME case-insensitively inside a colon-separated desktop list', () => {
    expect(evaluateSupport({ sessionType: 'wayland', currentDesktop: 'pop:GNOME' }).supported).toBe(true);
    expect(evaluateSupport({ sessionType: 'WAYLAND', currentDesktop: 'gnome' }).supported).toBe(true);
  });
});

/**
 * Read from /proc/<pid>/environ of a real URL side-car after the app had
 * auto-updated and relaunched itself: Electron copied its own `Unity` over
 * ORIGINAL_XDG_CURRENT_DESKTOP, and URL capture switched off.
 */
describe('readSessionEnvironment — after the app relaunches itself', () => {
  const relaunchedEnv = {
    XDG_SESSION_TYPE: 'wayland',
    XDG_CURRENT_DESKTOP: 'Unity',
    ORIGINAL_XDG_CURRENT_DESKTOP: 'Unity',
    XDG_SESSION_DESKTOP: 'ubuntu',
    DESKTOP_SESSION: 'ubuntu',
    GNOME_SHELL_SESSION_MODE: 'ubuntu',
    XDG_MENU_PREFIX: 'gnome-',
  };

  it('recovers the real desktop from markers Electron leaves alone', () => {
    expect(readSessionEnvironment(relaunchedEnv).currentDesktop).toBe('ubuntu:GNOME');
  });

  it('keeps that GNOME Wayland session supported', () => {
    expect(evaluateSupport(readSessionEnvironment(relaunchedEnv)).supported).toBe(true);
  });

  it('names plain GNOME as GNOME', () => {
    const env = { ...relaunchedEnv, XDG_SESSION_DESKTOP: 'gnome', DESKTOP_SESSION: 'gnome' };
    expect(readSessionEnvironment(env).currentDesktop).toBe('GNOME');
  });

  it('falls back to the session name on a desktop that is not GNOME', () => {
    const env = {
      XDG_SESSION_TYPE: 'wayland',
      XDG_CURRENT_DESKTOP: 'Unity',
      ORIGINAL_XDG_CURRENT_DESKTOP: 'Unity',
      XDG_SESSION_DESKTOP: 'KDE',
    };
    expect(readSessionEnvironment(env).currentDesktop).toBe('KDE');
    expect(evaluateSupport(readSessionEnvironment(env)).supported).toBe(false);
  });
});

describe('readSessionEnvironment — Electron rewrites XDG_CURRENT_DESKTOP', () => {
  // These are the literal values observed in a running Electron main
  // process on this machine (read from /proc/<pid>/environ) during a real
  // ubuntu:GNOME Wayland session. Chromium overwrites XDG_CURRENT_DESKTOP
  // with "Unity" and stashes the truth in ORIGINAL_XDG_CURRENT_DESKTOP.
  const electronEnv = {
    XDG_SESSION_TYPE: 'wayland',
    XDG_CURRENT_DESKTOP: 'Unity',
    ORIGINAL_XDG_CURRENT_DESKTOP: 'ubuntu:GNOME',
  };

  it('prefers ORIGINAL_XDG_CURRENT_DESKTOP over the value Chromium overwrote', () => {
    expect(readSessionEnvironment(electronEnv).currentDesktop).toBe('ubuntu:GNOME');
  });

  it('keeps a real GNOME Wayland session SUPPORTED when read through Electron', () => {
    // The regression this guards: reading the overwritten variable made a
    // genuine GNOME box report "supported only on GNOME" and disable
    // tracking entirely, in both the coverage screen and the resolver.
    expect(evaluateSupport(readSessionEnvironment(electronEnv)).supported).toBe(true);
  });

  it('falls back to XDG_CURRENT_DESKTOP when nothing rewrote it', () => {
    const plainEnv = { XDG_SESSION_TYPE: 'wayland', XDG_CURRENT_DESKTOP: 'ubuntu:GNOME' };
    expect(readSessionEnvironment(plainEnv).currentDesktop).toBe('ubuntu:GNOME');
    expect(evaluateSupport(readSessionEnvironment(plainEnv)).supported).toBe(true);
  });

  it('still rejects a genuinely non-GNOME Wayland session', () => {
    const kde = { XDG_SESSION_TYPE: 'wayland', ORIGINAL_XDG_CURRENT_DESKTOP: 'KDE' };
    expect(evaluateSupport(readSessionEnvironment(kde)).supported).toBe(false);
  });
});

describe('ADDRESS_BAR_ROLES — the roles real browsers actually use', () => {
  // Both observed directly on a live GNOME session, not assumed:
  //   Chrome  -> entry     :: "Address and search bar"
  //   Firefox -> combo box :: "Search with Google or enter address"
  // Matching only `entry` meant Firefox captured NOTHING while Chrome
  // worked perfectly, which is exactly the kind of silent gap this pins.
  it('covers the Chromium address bar role', () => {
    expect(ADDRESS_BAR_ROLES.has('entry')).toBe(true);
  });

  it('covers the Firefox address bar role, which is a combo box, not an entry', () => {
    expect(ADDRESS_BAR_ROLES.has('combo box')).toBe(true);
  });

  it('does not match generic container roles that would produce false positives', () => {
    for (const role of ['panel', 'section', 'tool bar', 'push button', 'menu']) {
      expect(ADDRESS_BAR_ROLES.has(role)).toBe(false);
    }
  });
});

describe('normalizeAppName', () => {
  it("maps AT-SPI's display name onto the registry's linux process name", () => {
    expect(normalizeAppName('Google Chrome')).toBe('google-chrome');
    expect(normalizeAppName('Firefox')).toBe('firefox');
  });

  it('collapses repeated whitespace and trims', () => {
    expect(normalizeAppName('  Brave   Browser ')).toBe('brave-browser');
  });
});

describe('hwndFromPath', () => {
  it("uses the AT-SPI object path's trailing id as a stable per-window handle", () => {
    expect(hwndFromPath('/org/a11y/atspi/accessible/5310')).toBe(5310);
  });

  it('falls back to 0 for a path with no trailing id rather than producing NaN', () => {
    expect(hwndFromPath('/org/a11y/atspi/accessible/root')).toBe(0);
  });
});

describe('pidFromBusName — keeping one browser apart from the next', () => {
  it("uses the bus name's connection id", () => {
    expect(pidFromBusName(':1.43')).toBe(43);
    expect(pidFromBusName(':1.143')).toBe(143);
  });

  it('falls back to 0 for an unparseable name rather than producing NaN', () => {
    expect(pidFromBusName('org.a11y.atspi.Registry')).toBe(0);
  });

  /**
   * The regression this function exists for: every browser numbers its own
   * windows from 1, so the session engine's `(pid, hwnd)` identity used to
   * collide across applications and only the first browser focused was
   * tracked.
   */
  it('separates the first window of two browsers that share an hwnd', () => {
    const chrome = { bus: ':1.20', path: '/org/a11y/atspi/accessible/1' };
    const brave = { bus: ':1.43', path: '/org/a11y/atspi/accessible/1' };

    expect(hwndFromPath(chrome.path)).toBe(hwndFromPath(brave.path));
    expect(pidFromBusName(chrome.bus)).not.toBe(pidFromBusName(brave.bus));
  });

  it('keeps two windows of the same browser under one application id', () => {
    expect(pidFromBusName(':1.20')).toBe(pidFromBusName(':1.20'));
    expect(hwndFromPath('/org/a11y/atspi/accessible/1')).not.toBe(
      hwndFromPath('/org/a11y/atspi/accessible/2'),
    );
  });
});

describe('hasReadableAddressBarText — telling the address bar from its decoys', () => {
  it('accepts a real URL reading', () => {
    expect(hasReadableAddressBarText('https://example.com/deep/path?q=1')).toBe(true);
    // Chromium elides the scheme; still readable.
    expect(hasReadableAddressBarText('example.com/search?q=full+path')).toBe(true);
  });

  it("rejects Opera's wrapper entry, which reads as embedded objects only", () => {
    // Captured from Opera 121: the outer `entry` named "Address bar", whose
    // real field sits two levels below it.
    expect(hasReadableAddressBarText('￼￼')).toBe(false);
  });

  it("rejects Firefox's search-engine picker sitting in the same toolbar", () => {
    // Captured from Firefox 155: a `combo box` beside the real one.
    expect(hasReadableAddressBarText('￼')).toBe(false);
  });

  it('rejects an empty or whitespace-only bar rather than treating it as a URL', () => {
    expect(hasReadableAddressBarText('')).toBe(false);
    expect(hasReadableAddressBarText('   ')).toBe(false);
  });

  it('keeps text that merely contains an embedded object alongside real content', () => {
    expect(hasReadableAddressBarText('￼example.com/page')).toBe(true);
  });
});

describe('MAX_SEARCH_DEPTH', () => {
  it("reaches Opera's address bar, which is far deeper than the other browsers'", () => {
    // Measured on Opera 121: the bar is at depth 13 and the field actually
    // holding the URL at depth 15. Chrome/Brave/Edge/Firefox sit around 4.
    // At the previous bound of 8, Opera produced no URLs at all and nothing
    // reported an error, so this guards the bound rather than the symptom.
    expect(MAX_SEARCH_DEPTH).toBeGreaterThanOrEqual(15);
  });
});
