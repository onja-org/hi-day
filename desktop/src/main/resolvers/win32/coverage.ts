import { CHROMIUM_GENERIC_KEY, type BrowserRegistry } from '../../url-capture/browser-registry';
import {
  approximateNoteFor,
  type BrowserCoverageRow,
  type CoverageReport,
  type CoverageStatus,
} from '../../url-capture/coverage-report';
import type { Confidence } from '../../url-capture/protocol';
import type { ResolverHealthSnapshot } from '../../url-capture/resolver-health';
import { InstalledBrowserDetector } from './installed-browsers';

function statusFor(resolverHealth: ResolverHealthSnapshot, uiaDisabled: boolean): CoverageStatus {
  if (resolverHealth.state === 'degraded') return 'off';
  if (uiaDisabled) return 'degraded'; // Step 16's remote kill switch: title-only fallback, still capturing something
  if (resolverHealth.state === 'restarting') return 'degraded';
  return 'active';
}

function reasonFor(status: CoverageStatus, uiaDisabled: boolean): string {
  if (status === 'off') return 'The tracking helper stopped responding after repeated crashes.';
  if (uiaDisabled) return 'URL tracking is temporarily disabled remotely; only page titles are recorded.';
  if (status === 'degraded') return 'The tracking helper is restarting after a crash.';
  return 'Active via UI Automation. No permission is required on Windows.';
}

export interface BuildWin32CoverageReportOptions {
  registry: BrowserRegistry;
  resolverHealth: ResolverHealthSnapshot;
  installedKeys: readonly string[];
  /**
   * Step 16's remote kill switch state — not wired to an actual remote
   * config decision yet (see win-resolver's --disable-uia and
   * native/win/README.md), so this always defaults to false today. Kept
   * as an explicit input rather than hardcoded so wiring the real
   * decision in later is additive, not a rewrite.
   */
  uiaDisabled?: boolean;
  now: number;
}

export function buildWin32CoverageReport(options: BuildWin32CoverageReportOptions): CoverageReport {
  const uiaDisabled = options.uiaDisabled ?? false;
  const browsers: BrowserCoverageRow[] = [];

  for (const [key, entry] of Object.entries(options.registry)) {
    if (key === CHROMIUM_GENERIC_KEY) continue; // a fallback strategy, not an individually-reportable browser
    if (!entry.match?.win32) continue; // no Windows presence for this browser at all (e.g. Safari, Arc)

    const installed = options.installedKeys.includes(key);
    if (!installed) {
      browsers.push({ key, installed: false, status: 'off', reason: 'Not installed.' });
      continue;
    }

    const status = statusFor(options.resolverHealth, uiaDisabled);
    const confidence: Confidence | undefined = status !== 'off' ? 'displayed' : undefined;
    browsers.push({
      key,
      installed: true,
      status,
      reason: reasonFor(status, uiaDisabled),
      confidence,
      approximateNote: approximateNoteFor(confidence),
    });
  }

  return { platform: 'win32', generatedAt: options.now, resolverHealth: options.resolverHealth, browsers };
}

export function detectInstalledWin32Browsers(registry: BrowserRegistry): Promise<string[]> {
  return new InstalledBrowserDetector().detectInstalled(registry);
}
