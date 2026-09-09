import { CHROMIUM_GENERIC_KEY, type BrowserRegistry } from '../../url-capture/browser-registry';
import { isAutomationTargetKey, type PermissionSnapshot, type PermissionState } from './permission-state';

export interface BrowserCapability {
  key: string;
  installed: boolean;
  active: boolean;
  /** One sentence, user-facing — this is what support reads to answer "why do I have no data" without a screen-share. */
  reason: string;
}

export interface CapabilityReport {
  platform: 'darwin';
  generatedAt: number;
  systemEvents: PermissionState;
  accessibility: PermissionState;
  screenRecording: PermissionState;
  browsers: BrowserCapability[];
}

function describeState(state: PermissionState, grantedVia: string, deniedNoun: string): { active: boolean; reason: string } {
  switch (state) {
    case 'granted':
      return { active: true, reason: `Active via ${grantedVia}.` };
    case 'denied':
      return { active: false, reason: `${deniedNoun} permission denied.` };
    case 'not-required':
      return { active: true, reason: `Active — no permission required.` };
    case 'unknown':
    default:
      return { active: false, reason: `${deniedNoun} permission not yet determined.` };
  }
}

export interface BuildCapabilityReportOptions {
  installedKeys: readonly string[];
  registry: BrowserRegistry;
  permissions: Readonly<PermissionSnapshot>;
  /** Injected, not Date.now() — keeps this a pure, easily-tested function. */
  now: number;
}

export function buildCapabilityReport(options: BuildCapabilityReportOptions): CapabilityReport {
  const browsers: BrowserCapability[] = [];

  for (const [key, entry] of Object.entries(options.registry)) {
    if (key === CHROMIUM_GENERIC_KEY) continue; // a fallback strategy, not an individually-reportable browser

    const installed = options.installedKeys.includes(key);
    if (!installed) {
      browsers.push({ key, installed: false, active: false, reason: 'Not installed.' });
      continue;
    }

    if (entry.family === 'gecko') {
      const { active, reason } = describeState(options.permissions.accessibility, 'Accessibility', 'Accessibility');
      browsers.push({ key, installed: true, active, reason });
      continue;
    }

    if (!entry.darwinAppName || !isAutomationTargetKey(key)) {
      browsers.push({
        key,
        installed: true,
        active: false,
        reason: 'Installed, but this browser has no supported capture strategy yet.',
      });
      continue;
    }

    const state = options.permissions.automation[key];
    const { active, reason } = describeState(state, 'Apple Events', 'Automation');
    browsers.push({ key, installed: true, active, reason });
  }

  return {
    platform: 'darwin',
    generatedAt: options.now,
    systemEvents: options.permissions.automation['system-events'],
    accessibility: options.permissions.accessibility,
    screenRecording: options.permissions.screenRecording,
    browsers,
  };
}
