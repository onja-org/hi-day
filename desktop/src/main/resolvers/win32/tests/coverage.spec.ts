import { describe, expect, it } from 'vitest';
import { loadBrowserRegistry } from '../../../url-capture/browser-registry';
import { ResolverHealthTracker } from '../../../url-capture/resolver-health';
import { buildWin32CoverageReport } from '../coverage';

const registry = loadBrowserRegistry();

function healthyResolver(): ReturnType<ResolverHealthTracker['snapshot']> {
  const tracker = new ResolverHealthTracker();
  tracker.onReady(1_700_000_000_000);
  return tracker.snapshot();
}

describe('buildWin32CoverageReport', () => {
  it('reports an installed browser as active with displayed confidence — Windows needs no permission', () => {
    const report = buildWin32CoverageReport({
      registry,
      installedKeys: ['chrome'],
      resolverHealth: healthyResolver(),
      now: 1_700_000_000_000,
    });

    expect(report.platform).toBe('win32');
    expect(report.browsers.find((b) => b.key === 'chrome')).toEqual({
      key: 'chrome',
      installed: true,
      status: 'active',
      reason: 'Active via UI Automation. No permission is required on Windows.',
      confidence: 'displayed',
      approximateNote: expect.stringContaining('Approximate'),
    });
  });

  it('reports an uninstalled browser as off with no confidence rating', () => {
    const report = buildWin32CoverageReport({
      registry,
      installedKeys: [],
      resolverHealth: healthyResolver(),
      now: 1_700_000_000_000,
    });

    expect(report.browsers.find((b) => b.key === 'chrome')).toEqual({
      key: 'chrome',
      installed: false,
      status: 'off',
      reason: 'Not installed.',
    });
  });

  it('excludes browsers with no win32 presence at all (e.g. Safari)', () => {
    const report = buildWin32CoverageReport({
      registry,
      installedKeys: [],
      resolverHealth: healthyResolver(),
      now: 1_700_000_000_000,
    });

    expect(report.browsers.find((b) => b.key === 'safari')).toBeUndefined();
  });

  it('reports degraded when the remote kill switch (--disable-uia) is engaged', () => {
    const report = buildWin32CoverageReport({
      registry,
      installedKeys: ['chrome'],
      resolverHealth: healthyResolver(),
      uiaDisabled: true,
      now: 1_700_000_000_000,
    });

    const chrome = report.browsers.find((b) => b.key === 'chrome');
    expect(chrome?.status).toBe('degraded');
    expect(chrome?.reason).toContain('disabled remotely');
  });

  it('reports off, not degraded, when the resolver process itself is dead — even with the kill switch off', () => {
    const tracker = new ResolverHealthTracker();
    tracker.onReady(1000);
    tracker.onDegraded();
    const report = buildWin32CoverageReport({
      registry,
      installedKeys: ['chrome'],
      resolverHealth: tracker.snapshot(),
      now: 1_700_000_000_000,
    });

    expect(report.browsers.find((b) => b.key === 'chrome')?.status).toBe('off');
  });
});
