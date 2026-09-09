import type { BrowserRegistry } from '../../url-capture/browser-registry';
import type { PermissionProbeResult } from './permission-probe';
import { isAutomationTargetKey, type PermissionStateMachine } from './permission-state';

/** The one method runOnboarding actually needs — real InstalledBrowserDetector satisfies this; tests can inject a plain stub. */
export interface InstalledBrowserSource {
  detectInstalled(registry: BrowserRegistry): Promise<string[]>;
}

/** The one method runOnboarding actually needs — real PermissionProbe satisfies this; tests can inject a plain stub. */
export interface AutomationProbeSource {
  probeAutomation(appName: string): Promise<PermissionProbeResult>;
}

export interface OnboardingOptions {
  registry: BrowserRegistry;
  detector: InstalledBrowserSource;
  probe: AutomationProbeSource;
  permissions: PermissionStateMachine;
}

export interface OnboardingProbeOutcome {
  key: string;
  result: PermissionProbeResult;
}

export interface OnboardingResult {
  installedKeys: string[];
  /** Only the ones actually probed — installed browsers with no Apple Events strategy (Arc, Firefox) are skipped, not silently "denied". */
  probed: OnboardingProbeOutcome[];
}

/**
 * Detects installed browsers, then proactively probes Automation for
 * whichever of them are ALSO currently running (Prompt B.3 point 3). A
 * browser that's installed but not running can't be probed without
 * launching it, which is never allowed — those are simply left unprobed;
 * their permission gets determined the first time the user actually
 * focuses that browser during real tracking.
 */
export async function runOnboarding(options: OnboardingOptions): Promise<OnboardingResult> {
  const installedKeys = await options.detector.detectInstalled(options.registry);
  const probed: OnboardingProbeOutcome[] = [];

  for (const key of installedKeys) {
    const entry = options.registry[key];
    if (!entry?.darwinAppName || !isAutomationTargetKey(key)) {
      // Firefox (Accessibility-gated, not Automation) or a browser with no
      // mapped Apple Events app name (Arc) — nothing to probe here.
      continue;
    }

    const result = await options.probe.probeAutomation(entry.darwinAppName);
    probed.push({ key, result });

    if (result.state === 'granted') {
      options.permissions.observeAppleEventsOutcome(key, null);
    } else if (result.state === 'denied') {
      options.permissions.observeAppleEventsOutcome(key, 'consent-denied');
    }
    // 'indeterminate' deliberately leaves the permission state untouched —
    // we didn't learn anything, so don't overwrite whatever it already was.
  }

  return { installedKeys, probed };
}
