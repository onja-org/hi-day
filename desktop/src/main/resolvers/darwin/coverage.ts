import type { Confidence } from '../../url-capture/protocol';
import type { BrowserRegistry } from '../../url-capture/browser-registry';
import { approximateNoteFor, type CoverageReport, type CoverageStatus } from '../../url-capture/coverage-report';
import type { ResolverHealthSnapshot } from '../../url-capture/resolver-health';
import { CHROMIUM_GENERIC_KEY } from '../../url-capture/browser-registry';
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

function statusFor(permissionActive: boolean, resolverHealth: ResolverHealthSnapshot): CoverageStatus {
  if (resolverHealth.state === 'degraded') return 'off'; // the whole resolver is dead — nothing is active regardless of permission state
  if (!permissionActive) return 'off';
  if (resolverHealth.state === 'restarting') return 'degraded';
  return 'active';
}

/** apple-events (chromium + Safari) is a real internal API read — exact. AX (Firefox) reads a rendered string — displayed. */
function confidenceFor(registry: BrowserRegistry, key: string): Confidence | undefined {
  const entry = registry[key];
  if (!entry) return undefined;
  return entry.family === 'gecko' ? 'displayed' : 'exact';
}

export type BuildDarwinCoverageReportOptions = BuildCapabilityReportOptions & { resolverHealth: ResolverHealthSnapshot };

/** F.1: adapts the existing darwin-specific CapabilityReport into the cross-platform CoverageReport shape the coverage screen renders. */
export function buildDarwinCoverageReport(options: BuildDarwinCoverageReportOptions): CoverageReport {
  const capabilityReport = buildCapabilityReport(options);

  return {
    platform: 'darwin',
    generatedAt: capabilityReport.generatedAt,
    resolverHealth: options.resolverHealth,
    browsers: capabilityReport.browsers.map((browser) => {
      const status = browser.installed ? statusFor(browser.active, options.resolverHealth) : 'off';
      const confidence = status !== 'off' ? confidenceFor(options.registry, browser.key) : undefined;
      return {
        key: browser.key,
        installed: browser.installed,
        status,
        reason: browser.reason,
        confidence,
        approximateNote: approximateNoteFor(confidence),
      };
    }),
  };
}
