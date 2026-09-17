import { spawn } from 'node:child_process';
import type { BrowserRegistry } from '../../url-capture/browser-registry';

export interface InstalledBrowserDetectorOptions {
  /** Overridable so tests can point this at a fake executable — 'reg' doesn't exist off Windows. */
  command?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 3_000;

/**
 * Detects installed browsers via the registry's "App Paths" key
 * (HKLM/HKCU ...\CurrentVersion\App Paths\<exe-name>) — the standard
 * Windows mechanism Explorer/Start-menu/"Open With" itself uses to
 * resolve a bare exe name, rather than guessing Program Files locations.
 * Mirrors resolvers/darwin/installed-browsers.ts's mdfind-based approach:
 * spawn a real OS query tool, no native addon, works regardless of where
 * the user actually installed the app.
 *
 * NEVER VERIFIED BY THE AGENT THAT WROTE THIS — no Windows machine
 * available; `reg query`'s exact exit-code/output behavior for a missing
 * key is documented but unconfirmed here.
 */
export class InstalledBrowserDetector {
  private readonly command: string;
  private readonly timeoutMs: number;

  constructor(options: InstalledBrowserDetectorOptions = {}) {
    this.command = options.command ?? 'reg';
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async isInstalled(exeName: string): Promise<boolean> {
    const key = `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`;
    const result = await this.runQuery(key);
    if (result) return true;
    // App Paths can also live under HKCU for a per-user install (e.g. a
    // browser installed without admin rights) — checked second since
    // HKLM (a machine-wide install) is the far more common case.
    const userKey = `HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`;
    return this.runQuery(userKey);
  }

  private runQuery(key: string): Promise<boolean> {
    return new Promise((resolvePromise) => {
      let settled = false;
      const child = spawn(this.command, ['query', key]);
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        resolvePromise(false);
      }, this.timeoutMs);

      child.on('error', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolvePromise(false);
      });
      child.on('exit', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolvePromise(code === 0);
      });
    });
  }

  /** Checks every registry entry with a win32 exe name, returning the registry keys that are installed. */
  async detectInstalled(registry: BrowserRegistry): Promise<string[]> {
    const candidates = Object.entries(registry)
      .map(([key, entry]) => ({ key, exeName: entry.match?.win32 }))
      .filter((c): c is { key: string; exeName: string } => typeof c.exeName === 'string');

    const results = await Promise.all(candidates.map((c) => this.isInstalled(c.exeName)));
    return candidates.filter((_, index) => results[index]).map((c) => c.key);
  }
}
