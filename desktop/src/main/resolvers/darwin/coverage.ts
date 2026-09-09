import type { Confidence } from '../../url-capture/protocol';
import type { BrowserRegistry } from '../../url-capture/browser-registry';
import { approximateNoteFor, type CoverageReport, type CoverageStatus } from '../../url-capture/coverage-report';
import type { ResolverHealthSnapshot } from '../../url-capture/resolver-health';
import { buildCapabilityReport, type BuildCapabilityReportOptions } from './capability-report';

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
