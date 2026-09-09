import { describe, expect, it } from 'vitest';
import { loadBrowserRegistry } from '../../../url-capture/browser-registry';
import { buildCapabilityReport } from '../capability-report';
import { PermissionStateMachine } from '../permission-state';

const registry = loadBrowserRegistry();

describe('buildCapabilityReport', () => {
  it('reports an uninstalled browser as inactive with a clear reason, no permission lookup needed', () => {
    const machine = new PermissionStateMachine();
    const report = buildCapabilityReport({
      installedKeys: [],
      registry,
      permissions: machine.get(),
      now: 1_700_000_000_000,
    });
    const chrome = report.browsers.find((b) => b.key === 'chrome');
    expect(chrome).toEqual({ key: 'chrome', installed: false, active: false, reason: 'Not installed.' });
  });

  it('reports an installed, granted chromium browser as active via Apple Events', () => {
    const machine = new PermissionStateMachine();
    machine.observeAppleEventsOutcome('chrome', null);
    const report = buildCapabilityReport({
      installedKeys: ['chrome'],
      registry,
      permissions: machine.get(),
      now: 1_700_000_000_000,
    });
    expect(report.browsers.find((b) => b.key === 'chrome')).toEqual({
      key: 'chrome',
      installed: true,
      active: true,
      reason: 'Active via Apple Events.',
    });
  });

  it('reports an installed, denied chromium browser as inactive with the denial reason', () => {
    const machine = new PermissionStateMachine();
    machine.observeAppleEventsOutcome('safari', 'consent-denied');
    const report = buildCapabilityReport({
      installedKeys: ['safari'],
      registry,
      permissions: machine.get(),
      now: 1_700_000_000_000,
    });
    expect(report.browsers.find((b) => b.key === 'safari')).toEqual({
      key: 'safari',
      installed: true,
      active: false,
      reason: 'Automation permission denied.',
    });
  });

  it('reports Firefox against the accessibility gate, not automation', () => {
    const machine = new PermissionStateMachine();
    machine.setAccessibility('granted');
    const report = buildCapabilityReport({
      installedKeys: ['firefox'],
      registry,
      permissions: machine.get(),
      now: 1_700_000_000_000,
    });
    expect(report.browsers.find((b) => b.key === 'firefox')).toEqual({
      key: 'firefox',
      installed: true,
      active: true,
      reason: 'Active via Accessibility.',
    });
  });

  it('reports an installed browser with no supported strategy (Arc) without crashing', () => {
    const machine = new PermissionStateMachine();
    const report = buildCapabilityReport({
      installedKeys: ['arc'],
      registry,
      permissions: machine.get(),
      now: 1_700_000_000_000,
    });
    expect(report.browsers.find((b) => b.key === 'arc')).toEqual({
      key: 'arc',
      installed: true,
      active: false,
      reason: 'Installed, but this browser has no supported capture strategy yet.',
    });
  });

  it('never includes chromium-generic as its own reportable row', () => {
    const machine = new PermissionStateMachine();
    const report = buildCapabilityReport({ installedKeys: [], registry, permissions: machine.get(), now: 0 });
    expect(report.browsers.find((b) => b.key === 'chromium-generic')).toBeUndefined();
  });

  it('surfaces systemEvents, accessibility, and screenRecording at the top level', () => {
    const machine = new PermissionStateMachine();
    machine.observeAppleEventsOutcome('system-events', null);
    machine.setAccessibility('denied');
    const report = buildCapabilityReport({ installedKeys: [], registry, permissions: machine.get(), now: 5 });
    expect(report.systemEvents).toBe('granted');
    expect(report.accessibility).toBe('denied');
    expect(report.screenRecording).toBe('not-required');
    expect(report.generatedAt).toBe(5);
    expect(report.platform).toBe('darwin');
  });
});
