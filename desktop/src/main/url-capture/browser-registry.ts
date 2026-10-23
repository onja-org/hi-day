import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Browser knowledge lives as data (this JSON file), not code, per Step 2 of
 * docs/url-tracking-plan.md — adding a browser or fixing a broken selector
 * strategy should be a JSON edit, not a rebuild.
 */
export type RegistryPlatform = 'darwin' | 'win32' | 'linux';
export type BrowserFamily = 'chromium' | 'gecko' | 'webkit';

export interface BrowserRegistryEntry {
  match?: Partial<Record<RegistryPlatform, string>>;
  family: BrowserFamily;
  strategy: Partial<Record<RegistryPlatform, string>>;
  privateDetect: string;
  /**
   * The app/process name AppleScript needs for `tell application "..."` and
   * `System Events`' `process "..."` — distinct from the bundle id in
   * `match.darwin`, which AppleScript can't address a running process by.
   * Only meaningful on darwin; absent for browsers the Apple Events resolver
   * doesn't (yet) support by name (e.g. Firefox, which uses the AX helper).
   */
  darwinAppName?: string;
}

export type BrowserRegistry = Record<string, BrowserRegistryEntry>;

export const CHROMIUM_GENERIC_KEY = 'chromium-generic';

const DEFAULT_REGISTRY_PATH = join(__dirname, 'browser-registry.json');

function isBrowserRegistryEntry(value: unknown): value is BrowserRegistryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.family === 'string' && typeof entry.strategy === 'object';
}

export function loadBrowserRegistry(filePath: string = DEFAULT_REGISTRY_PATH): BrowserRegistry {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Browser registry at ${filePath} is not a JSON object.`);
  }

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isBrowserRegistryEntry(value)) {
      throw new Error(`Browser registry entry "${key}" at ${filePath} is malformed.`);
    }
  }

  return parsed as BrowserRegistry;
}

export interface BrowserLookupResult {
  key: string;
  entry: BrowserRegistryEntry;
}

/**
 * Finds the registry entry whose `match[platform]` equals the given process
 * name (Windows/Linux) or bundle id (macOS). Falls back to
 * `chromium-generic` when nothing matches — never throws, since an unknown
 * or newly-released browser should degrade to the generic strategy rather
 * than disable capture entirely.
 */
export function lookupBrowser(
  registry: BrowserRegistry,
  platform: RegistryPlatform,
  processNameOrBundleId: string,
): BrowserLookupResult {
  for (const [key, entry] of Object.entries(registry)) {
    if (entry.match?.[platform] === processNameOrBundleId) {
      return { key, entry };
    }
  }

  const fallback = registry[CHROMIUM_GENERIC_KEY];
  if (!fallback) {
    throw new Error(`Browser registry is missing its required "${CHROMIUM_GENERIC_KEY}" fallback entry.`);
  }
  return { key: CHROMIUM_GENERIC_KEY, entry: fallback };
}

/**
 * AT-SPI reports an application's display name ("Google Chrome"); the
 * registry keys Linux entries by process name ("google-chrome"). Normalize
 * before matching rather than duplicating every name in the registry.
 */
export function normalizeAppName(appName: string): string {
  return appName.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * The registry key of the browser a focus event's `app` names, or null when
 * it names no known browser. Strict, unlike `lookupBrowser`: that one falls
 * back to the generic Chromium strategy for anything, which is right for
 * picking how to read an address bar but would call a terminal a browser.
 *
 * Each side-car names the focused app its own way: the AT-SPI display name
 * on Linux, the process name on Windows, the application name on macOS.
 */
export function identifyBrowser(
  registry: BrowserRegistry,
  platform: RegistryPlatform,
  app: string,
): string | null {
  const name = platform === 'linux' ? normalizeAppName(app) : app;
  for (const [key, entry] of Object.entries(registry)) {
    if (entry.match?.[platform] === name) return key;
    if (platform === 'darwin' && entry.darwinAppName === name) return key;
  }
  return null;
}
