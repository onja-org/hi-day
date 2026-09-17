import { describe, expect, it } from 'vitest';
import { loadBrowserRegistry } from '../../../url-capture/browser-registry';
import type { AutomationProbeSource, InstalledBrowserSource } from '../permission-onboarding';
import { runOnboarding } from '../permission-onboarding';
import { PermissionStateMachine } from '../permission-state';
import type { PermissionProbeResult } from '../permission-probe';

const registry = loadBrowserRegistry();

function stubDetector(installedKeys: string[]): InstalledBrowserSource {
  return { detectInstalled: () => Promise.resolve(installedKeys) };
}

function stubProbe(resultsByAppName: Record<string, PermissionProbeResult>): AutomationProbeSource {
  return {
    probeAutomation: (appName) =>
      Promise.resolve(resultsByAppName[appName] ?? { state: 'indeterminate', reason: 'no stub for this app' }),
  };
}

describe('runOnboarding', () => {
  it('probes every installed, automation-capable browser and records granted results', async () => {
    const permissions = new PermissionStateMachine();
    const result = await runOnboarding({
      registry,
      detector: stubDetector(['chrome', 'safari']),
      probe: stubProbe({ 'Google Chrome': { state: 'granted' }, Safari: { state: 'granted' } }),
      permissions,
    });

    expect(result.installedKeys).toEqual(['chrome', 'safari']);
    expect(result.probed).toEqual([
      { key: 'chrome', result: { state: 'granted' } },
      { key: 'safari', result: { state: 'granted' } },
    ]);
    expect(permissions.get().automation.chrome).toBe('granted');
    expect(permissions.get().automation.safari).toBe('granted');
  });

  it('records a denied probe result in the permission state machine', async () => {
    const permissions = new PermissionStateMachine();
    await runOnboarding({
      registry,
      detector: stubDetector(['chrome']),
      probe: stubProbe({ 'Google Chrome': { state: 'denied' } }),
      permissions,
    });
    expect(permissions.get().automation.chrome).toBe('denied');
  });

  it('leaves permission state untouched on an indeterminate result', async () => {
    const permissions = new PermissionStateMachine();
    permissions.observeAppleEventsOutcome('chrome', null); // already granted from earlier real use
    await runOnboarding({
      registry,
      detector: stubDetector(['chrome']),
      probe: stubProbe({ 'Google Chrome': { state: 'indeterminate', reason: 'busy' } }),
      permissions,
    });
    expect(permissions.get().automation.chrome).toBe('granted'); // unchanged, not overwritten
  });

  it('skips Firefox (accessibility-gated, not automation) without probing or crashing', async () => {
    const permissions = new PermissionStateMachine();
    let probeCalled = false;
    const result = await runOnboarding({
      registry,
      detector: stubDetector(['firefox']),
      probe: {
        probeAutomation: () => {
          probeCalled = true;
          return Promise.resolve({ state: 'granted' });
        },
      },
      permissions,
    });
    expect(probeCalled).toBe(false);
    expect(result.probed).toEqual([]);
  });

  it('skips a browser with no darwinAppName mapped (Arc) without probing or crashing', async () => {
    const permissions = new PermissionStateMachine();
    const result = await runOnboarding({
      registry,
      detector: stubDetector(['arc']),
      probe: stubProbe({}),
      permissions,
    });
    expect(result.probed).toEqual([]);
  });
});
