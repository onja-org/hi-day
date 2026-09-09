import type { AppleEventsErrorCode } from './errors';

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'not-required';

/**
 * Automation consent in macOS TCC is granted per (our app, target app) pair
 * — "Automation for Chrome" and "Automation for Safari" are entirely
 * separate grants. `system-events` is its own target because focus
 * detection (`focus-monitor.ts`) sends Apple Events to System Events
 * itself, independent of whichever browser is actually focused.
 */
export type AutomationTargetKey =
  | 'system-events'
  | 'chrome'
  | 'edge'
  | 'brave'
  | 'opera'
  | 'vivaldi'
  | 'safari';

const AUTOMATION_TARGETS: readonly AutomationTargetKey[] = [
  'system-events',
  'chrome',
  'edge',
  'brave',
  'opera',
  'vivaldi',
  'safari',
];

const AUTOMATION_TARGET_SET = new Set<string>(AUTOMATION_TARGETS);

export function isAutomationTargetKey(key: string): key is AutomationTargetKey {
  return AUTOMATION_TARGET_SET.has(key);
}

export interface PermissionSnapshot {
  automation: Record<AutomationTargetKey, PermissionState>;
  accessibility: PermissionState;
  /**
   * Modeled but defaulted to 'not-required': the original plan assumed
   * get-windows (which needs Screen Recording for window titles). This
   * implementation reads titles via System Events/Accessibility instead
   * (see the B.1 design note on dropping get-windows), which is not
   * believed to need Screen Recording at all — flagged here for real
   * hardware to confirm rather than asserted with false confidence.
   */
  screenRecording: PermissionState;
}

function initialAutomationStates(): Record<AutomationTargetKey, PermissionState> {
  const states = {} as Record<AutomationTargetKey, PermissionState>;
  for (const target of AUTOMATION_TARGETS) {
    states[target] = 'unknown';
  }
  return states;
}

/**
 * Never assume a granted permission stays granted (Prompt B.3 point 1) — the
 * user can revoke any of these in System Settings at any moment, including
 * while the machine is asleep. `resetAll()` is what a caller invokes on
 * launch and on powerMonitor's `resume` event; nothing here schedules that
 * itself, since this class has no clock/lifecycle of its own (same
 * pure-state-container discipline as SessionEngine).
 */
export class PermissionStateMachine {
  private snapshot: PermissionSnapshot;

  constructor(initial?: Partial<PermissionSnapshot>) {
    this.snapshot = {
      automation: { ...initialAutomationStates(), ...initial?.automation },
      accessibility: initial?.accessibility ?? 'unknown',
      screenRecording: initial?.screenRecording ?? 'not-required',
    };
  }

  get(): Readonly<PermissionSnapshot> {
    return this.snapshot;
  }

  /**
   * Feeds the outcome of a real Apple Events attempt back into the state —
   * this IS the probe, since Automation has no dedicated no-prompt check
   * API the way Accessibility does. Any outcome other than `consent-denied`
   * proves the Apple Event reached the target at all, which only happens
   * once Automation is granted for that (us, target) pair.
   */
  observeAppleEventsOutcome(target: AutomationTargetKey, errorCode: AppleEventsErrorCode | null): void {
    this.snapshot.automation[target] = errorCode === 'consent-denied' ? 'denied' : 'granted';
  }

  setAccessibility(state: PermissionState): void {
    this.snapshot.accessibility = state;
  }

  setScreenRecording(state: PermissionState): void {
    this.snapshot.screenRecording = state;
  }

  /**
   * Called on launch and on resume — every gate that isn't `not-required`
   * reverts to `unknown` (denied included: the user may have just fixed it
   * in System Settings) until freshly observed again.
   */
  resetAll(): void {
    for (const target of AUTOMATION_TARGETS) {
      this.snapshot.automation[target] = 'unknown';
    }
    if (this.snapshot.accessibility !== 'not-required') {
      this.snapshot.accessibility = 'unknown';
    }
    if (this.snapshot.screenRecording !== 'not-required') {
      this.snapshot.screenRecording = 'unknown';
    }
  }
}

export { AUTOMATION_TARGETS };
