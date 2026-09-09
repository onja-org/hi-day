import type { OsascriptRunner } from './osascript-runner';
import { PERMISSION_PROBE_SCRIPT, materializeScript } from './scripts';

export type PermissionProbeResult =
  | { state: 'granted' }
  | { state: 'denied' }
  /**
   * Either the browser isn't currently running (can't probe without
   * launching it — not allowed), or the probe genuinely couldn't tell
   * (timeout/busy/unexpected error). Onboarding treats both the same way:
   * "nothing to report yet," never a false grant or false deny.
   */
  | { state: 'indeterminate'; reason: string };

/**
 * Proactively triggers the Automation consent prompt for an installed,
 * currently-running browser during onboarding (Prompt B.3 point 3) —
 * shares the caller's `OsascriptRunner` instance rather than owning one, so
 * the "never more than one osascript process in flight" bound (Prompt B.1)
 * stays global across focus polling, resolving, and probing alike.
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
