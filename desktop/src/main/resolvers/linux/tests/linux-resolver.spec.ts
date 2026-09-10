import { describe, expect, it } from 'vitest';
import { loadBrowserRegistry } from '../../../url-capture/browser-registry';
import { ResolverHealthTracker } from '../../../url-capture/resolver-health';
import { buildLinuxCoverageReport, detectInstalledLinuxBrowsers } from '../coverage';
import { hwndFromPath, normalizeAppName } from '../index';
import { evaluateSupport } from '../support-gate';

const registry = loadBrowserRegistry();

function healthyResolver(): ReturnType<ResolverHealthTracker['snapshot']> {
  const tracker = new ResolverHealthTracker();
  tracker.onReady(1_700_000_000_000);
  return tracker.snapshot();
}

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

describe('buildLinuxCoverageReport', () => {
  it('reports an installed browser as active on a supported session', () => {
    const report = buildLinuxCoverageReport({
      registry,
      installedKeys: ['chrome'],
      resolverHealth: healthyResolver(),
      support: evaluateSupport({ sessionType: 'wayland', currentDesktop: 'ubuntu:GNOME' }),
      now: 1_700_000_000_000,
    });

    expect(report.platform).toBe('linux');
    const chrome = report.browsers.find((b) => b.key === 'chrome');
    expect(chrome).toMatchObject({ installed: true, status: 'active', confidence: 'displayed' });
  });

  it('reports every installed browser as off on an unsupported session, explaining why', () => {
    const report = buildLinuxCoverageReport({
      registry,
      installedKeys: ['chrome'],
      resolverHealth: healthyResolver(),
      support: evaluateSupport({ sessionType: 'wayland', currentDesktop: 'KDE' }),
      now: 1_700_000_000_000,
    });

    const chrome = report.browsers.find((b) => b.key === 'chrome');
    expect(chrome?.status).toBe('off');
    expect(chrome?.reason).toContain('GNOME');
    // No confidence rating when nothing is being captured.
    expect(chrome?.confidence).toBeUndefined();
  });

  it('omits browsers with no Linux presence entirely', () => {
    const report = buildLinuxCoverageReport({
      registry,
      installedKeys: [],
      resolverHealth: healthyResolver(),
      support: evaluateSupport({ sessionType: 'x11', currentDesktop: 'i3' }),
      now: 1_700_000_000_000,
    });

    // Safari has no `match.linux`, so it must not appear as a Linux row.
    expect(report.browsers.find((b) => b.key === 'safari')).toBeUndefined();
  });
});

describe('detectInstalledLinuxBrowsers', () => {
  it('finds nothing when PATH contains no browser executables', () => {
    const originalPath = process.env.PATH;
    process.env.PATH = '/nonexistent-directory-for-this-test';
    try {
      expect(detectInstalledLinuxBrowsers(registry)).toEqual([]);
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it('never reports the chromium-generic fallback as an installed browser', () => {
    expect(detectInstalledLinuxBrowsers(registry)).not.toContain('chromium-generic');
  });
});
