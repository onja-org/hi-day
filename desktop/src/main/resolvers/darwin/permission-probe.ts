import type { OsascriptRunner } from './osascript-runner';
import { PERMISSION_PROBE_SCRIPT, materializeScript } from './scripts';

export type PermissionProbeResult =
  | { state: 'granted' }
  | { state: 'denied' }
  /**
   * The browser isn't running (probing would launch it — not allowed), or the
   * probe couldn't tell. Onboarding treats both as "nothing to report yet",
   * never a false grant or deny.
   */
  | { state: 'indeterminate'; reason: string };

/**
 * Triggers the Automation consent prompt for a running browser during
 * onboarding. Shares the caller's OsascriptRunner so the "one osascript in
 * flight" bound stays global across polling, resolving and probing.
 */
export class PermissionProbe {
  constructor(private readonly runner: OsascriptRunner) {}

  async probeAutomation(appName: string): Promise<PermissionProbeResult> {
    const scriptPath = materializeScript('permission-probe', PERMISSION_PROBE_SCRIPT);
    const outcome = await this.runner.run(scriptPath, [appName]);

    if (outcome.ok) return { state: 'granted' };
    if (outcome.error.code === 'consent-denied') return { state: 'denied' };
    if (outcome.error.code === 'not-running') {
      return { state: 'indeterminate', reason: 'not currently running' };
    }
    return { state: 'indeterminate', reason: outcome.error.message };
  }
}
