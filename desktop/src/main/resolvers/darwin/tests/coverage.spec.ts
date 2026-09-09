import { describe, expect, it } from 'vitest';
import { loadBrowserRegistry } from '../../../url-capture/browser-registry';
import { ResolverHealthTracker } from '../../../url-capture/resolver-health';
import { buildDarwinCoverageReport } from '../coverage';
import { PermissionStateMachine } from '../permission-state';

const registry = loadBrowserRegistry();

function healthyResolver(): ReturnType<ResolverHealthTracker['snapshot']> {
  const tracker = new ResolverHealthTracker();
  tracker.onReady(1_700_000_000_000);
  return tracker.snapshot();
}

describe('buildDarwinCoverageReport', () => {
  it('reports an installed, granted chromium browser as active with exact confidence', () => {
    const machine = new PermissionStateMachine();
    machine.observeAppleEventsOutcome('chrome', null);
    const report = buildDarwinCoverageReport({
      installedKeys: ['chrome'],
      registry,
      permissions: machine.get(),
      resolverHealth: healthyResolver(),
      now: 1_700_000_000_000,
    });

    expect(report.platform).toBe('darwin');
    expect(report.browsers.find((b) => b.key === 'chrome')).toEqual({
      key: 'chrome',
      installed: true,
      status: 'active',
      reason: 'Active via Apple Events.',
      confidence: 'exact',
    });
  });

  it('reports Firefox (gecko, AX-based) as displayed confidence, not exact — and gets the approximate marker', () => {
    const machine = new PermissionStateMachine();
    machine.setAccessibility('granted');
    const report = buildDarwinCoverageReport({
      installedKeys: ['firefox'],
      registry,
      permissions: machine.get(),
      resolverHealth: healthyResolver(),
      now: 1_700_000_000_000,
    });

    const firefox = report.browsers.find((b) => b.key === 'firefox');
    expect(firefox?.confidence).toBe('displayed');
    expect(firefox?.approximateNote).toBeDefined();
  });

  it('does not attach an approximate marker to an exact-confidence (apple-events) row', () => {
    const machine = new PermissionStateMachine();
    machine.observeAppleEventsOutcome('chrome', null);
    const report = buildDarwinCoverageReport({
      installedKeys: ['chrome'],
      registry,
      permissions: machine.get(),
      resolverHealth: healthyResolver(),
      now: 1_700_000_000_000,
    });

    expect(report.browsers.find((b) => b.key === 'chrome')?.approximateNote).toBeUndefined();
  });

  it('reports a denied browser as off, with no confidence rating', () => {
    const machine = new PermissionStateMachine();
    machine.observeAppleEventsOutcome('safari', 'consent-denied');
    const report = buildDarwinCoverageReport({
      installedKeys: ['safari'],
      registry,
      permissions: machine.get(),
      resolverHealth: healthyResolver(),
      now: 1_700_000_000_000,
    });

    const safari = report.browsers.find((b) => b.key === 'safari');
    expect(safari?.status).toBe('off');
    expect(safari?.confidence).toBeUndefined();
  });

  it('reports every browser as off when the resolver itself is degraded, regardless of permission state', () => {
    const machine = new PermissionStateMachine();
    machine.observeAppleEventsOutcome('chrome', null); // permission is fine...
    const tracker = new ResolverHealthTracker();
    tracker.onReady(1000);
    tracker.onDegraded(); // ...but the resolver process itself has given up
    const report = buildDarwinCoverageReport({
      installedKeys: ['chrome'],
      registry,
      permissions: machine.get(),
      resolverHealth: tracker.snapshot(),
      now: 1_700_000_000_000,
    });

    expect(report.browsers.find((b) => b.key === 'chrome')?.status).toBe('off');
  });

  it('reports a restarting resolver as degraded, not off, for an otherwise-granted browser', () => {
    const machine = new PermissionStateMachine();
    machine.observeAppleEventsOutcome('chrome', null);
    const tracker = new ResolverHealthTracker();
    tracker.onReady(1000);
    tracker.onRestarting();
    const report = buildDarwinCoverageReport({
      installedKeys: ['chrome'],
      registry,
      permissions: machine.get(),
      resolverHealth: tracker.snapshot(),
      now: 1_700_000_000_000,
    });

    expect(report.browsers.find((b) => b.key === 'chrome')?.status).toBe('degraded');
  });
});
