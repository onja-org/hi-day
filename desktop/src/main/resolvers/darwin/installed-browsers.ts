import type { BrowserRegistry } from '../../url-capture/browser-registry';
import { spawnWithTimeout } from './spawn-with-timeout';

export interface InstalledBrowserDetectorOptions {
  /** Overridable so tests can point this at a fake executable — 'mdfind' doesn't exist off macOS. */
  command?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 3_000;

/**
 * Detects installed browsers via Spotlight metadata (`mdfind`) rather than
 * guessing /Applications paths — works regardless of where the user
 * actually installed the app, with no native addon and no launching
 * anything. Installed-but-not-currently-running is exactly the case
 * onboarding can't proactively prompt for (see permission-probe.ts) — this
 * is what tells the onboarding flow which browsers even exist to ask about.
 */
export class InstalledBrowserDetector {
  private readonly command: string;
  private readonly timeoutMs: number;

  constructor(options: InstalledBrowserDetectorOptions = {}) {
    this.command = options.command ?? 'mdfind';
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async isInstalled(bundleId: string): Promise<boolean> {
    const result = await spawnWithTimeout(this.command, [`kMDItemCFBundleIdentifier == '${bundleId}'`], this.timeoutMs);
    if (result.spawnError || result.timedOut || result.exitCode !== 0) return false;
    return result.stdout.trim().length > 0;
  }

  /** Checks every registry entry with a darwin bundle id, returning the registry keys that are installed. */
  async detectInstalled(registry: BrowserRegistry): Promise<string[]> {
    const candidates = Object.entries(registry)
      .map(([key, entry]) => ({ key, bundleId: entry.match?.darwin }))
      .filter((c): c is { key: string; bundleId: string } => typeof c.bundleId === 'string');

    const results = await Promise.all(
      candidates.map(async (candidate) => ({ key: candidate.key, installed: await this.isInstalled(candidate.bundleId) })),
    );
    return results.filter((r) => r.installed).map((r) => r.key);
  }
}
