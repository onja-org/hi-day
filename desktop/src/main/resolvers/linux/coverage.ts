import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import { CHROMIUM_GENERIC_KEY, type BrowserRegistry } from '../../url-capture/browser-registry';
import {
  approximateNoteFor,
  type BrowserCoverageRow,
  type CoverageReport,
  type CoverageStatus,
} from '../../url-capture/coverage-report';
import type { Confidence } from '../../url-capture/protocol';
import type { ResolverHealthSnapshot } from '../../url-capture/resolver-health';
import type { SupportVerdict } from './support-gate';

function statusFor(health: ResolverHealthSnapshot, support: SupportVerdict): CoverageStatus {
  if (!support.supported) return 'off';
  if (health.state === 'degraded') return 'off';
  if (health.state === 'restarting') return 'degraded';
  return 'active';
}

export interface BuildLinuxCoverageReportOptions {
  registry: BrowserRegistry;
  installedKeys: readonly string[];
  resolverHealth: ResolverHealthSnapshot;
  support: SupportVerdict;
  now: number;
}

export function buildLinuxCoverageReport(options: BuildLinuxCoverageReportOptions): CoverageReport {
  const browsers: BrowserCoverageRow[] = [];

  for (const [key, entry] of Object.entries(options.registry)) {
    if (key === CHROMIUM_GENERIC_KEY) continue;
    if (!entry.match?.linux) continue;

    if (!options.installedKeys.includes(key)) {
      browsers.push({ key, installed: false, status: 'off', reason: 'Not installed.' });
      continue;
    }

    const status = statusFor(options.resolverHealth, options.support);
    const confidence: Confidence | undefined = status !== 'off' ? 'displayed' : undefined;
    browsers.push({
      key,
      installed: true,
      status,
      reason: options.support.supported
        ? status === 'off'
          ? 'The tracking helper stopped responding after repeated crashes.'
          : status === 'degraded'
            ? 'The tracking helper is restarting after a crash.'
            : options.support.reason
        : options.support.reason,
      confidence,
      approximateNote: approximateNoteFor(confidence),
    });
  }

  return {
    platform: 'linux',
    generatedAt: options.now,
    resolverHealth: options.resolverHealth,
    browsers,
  };
}

/**
 * Detects installed browsers by looking for their executable on PATH —
 * the same thing a shell does to run `google-chrome`, and how the
 * registry's `match.linux` values are already named. Deliberately no
 * subprocess (unlike darwin's `mdfind` and win32's `reg query`, which have
 * no in-process equivalent): a PATH scan is a handful of stat calls, so
 * spawning `which` per browser would be strictly slower and add a failure
 * mode for nothing.
 */
export function detectInstalledLinuxBrowsers(registry: BrowserRegistry): string[] {
  const pathDirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const installed: string[] = [];

  for (const [key, entry] of Object.entries(registry)) {
    if (key === CHROMIUM_GENERIC_KEY) continue;
    const executable = entry.match?.linux;
    if (!executable) continue;

    const found = pathDirs.some((dir) => {
      try {
        accessSync(join(dir, executable), constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
    if (found) installed.push(key);
  }
  return installed;
}
