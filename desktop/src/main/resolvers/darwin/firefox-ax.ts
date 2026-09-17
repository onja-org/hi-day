import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnWithTimeout } from './spawn-with-timeout';

export type FirefoxAxErrorCode =
  | 'permission-denied'
  | 'no-window'
  | 'field-not-found'
  | 'bad-invocation'
  | 'timeout'
  | 'unknown';

export interface FirefoxAxError {
  code: FirefoxAxErrorCode;
  message: string;
}

export interface FirefoxAxSuccess {
  ok: true;
  url: string;
  title: string;
  private: boolean;
}
export interface FirefoxAxFailure {
  ok: false;
  error: FirefoxAxError;
}
export type FirefoxAxResult = FirefoxAxSuccess | FirefoxAxFailure;

export interface FirefoxAxResolverOptions {
  /** Overridable so tests can point this at a fake executable — the real binary is macOS-only. */
  binaryPath?: string;
  timeoutMs?: number;
  privateMarkersPath?: string;
}

const DEFAULT_TIMEOUT_MS = 2_000;
// Correct for dev (electron .) and a plain `pnpm build` output, since both
// put dist/main (or src/main) at the same depth relative to native/darwin.
// NOT correct inside a packaged app — there, native/darwin is under
// process.resourcesPath (electron-builder's extraResources), not reachable
// by walking up from __dirname inside the asar archive. Whoever wires this
// side-car into main.ts (not done yet — this class isn't spawned by
// anything in main.ts today) needs to pass an explicit `binaryPath`
// computed from process.resourcesPath when app.isPackaged is true.
const DEFAULT_BINARY_PATH = join(__dirname, '../../../../native/darwin/firefox-ax-helper');
const DEFAULT_MARKERS_PATH = join(__dirname, 'firefox-private-markers.json');

function loadPrivateMarkers(path: string): string[] {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'));
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as { markers?: unknown }).markers)) {
    throw new Error(`firefox-private-markers.json at ${path} is missing its "markers" array.`);
  }
  const raw = parsed as { markers: unknown[] };
  return raw.markers.filter((m): m is string => typeof m === 'string');
}

function isPrivateWindowTitle(title: string, markers: readonly string[]): boolean {
  return markers.some((marker) => title.includes(marker));
}

/**
 * Wraps the compiled firefox-ax-helper Swift binary — see Prompt B.2 and
 * docs/url-tracking-plan.md Step 10. The binary itself is deliberately dumb
 * (raw toolbar value + raw window title); private-mode detection against
 * the per-locale marker table happens here, in TypeScript, so the marker
 * list can be extended without recompiling a Swift binary neither of us can
 * build in this environment.
 */
export class FirefoxAxResolver {
  private readonly binaryPath: string;
  private readonly timeoutMs: number;
  private readonly privateMarkers: string[];

  constructor(options: FirefoxAxResolverOptions = {}) {
    this.binaryPath = options.binaryPath ?? DEFAULT_BINARY_PATH;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.privateMarkers = loadPrivateMarkers(options.privateMarkersPath ?? DEFAULT_MARKERS_PATH);
  }

  async resolve(pid: number): Promise<FirefoxAxResult> {
    const result = await spawnWithTimeout(this.binaryPath, ['resolve', String(pid)], this.timeoutMs);

    if (result.spawnError) {
      return { ok: false, error: { code: 'unknown', message: `Failed to spawn firefox-ax-helper: ${result.spawnError}` } };
    }
    if (result.timedOut) {
      return { ok: false, error: { code: 'timeout', message: 'firefox-ax-helper did not complete within the deadline.' } };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      return {
        ok: false,
        error: { code: 'unknown', message: `Malformed firefox-ax-helper output: ${result.stdout.slice(0, 200)}` },
      };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return {
        ok: false,
        error: { code: 'unknown', message: `Unexpected firefox-ax-helper output shape: ${result.stdout.slice(0, 200)}` },
      };
    }
    const obj = parsed as Record<string, unknown>;

    if (obj.ok === false) {
      const code: FirefoxAxErrorCode =
        typeof obj.code === 'string' && isFirefoxAxErrorCode(obj.code) ? obj.code : 'unknown';
      const message = typeof obj.message === 'string' ? obj.message : 'Unknown firefox-ax-helper failure.';
      return { ok: false, error: { code, message } };
    }

    if (obj.ok !== true || typeof obj.value !== 'string' || typeof obj.title !== 'string') {
      return {
        ok: false,
        error: { code: 'unknown', message: `Unexpected firefox-ax-helper output shape: ${result.stdout.slice(0, 200)}` },
      };
    }

    return {
      ok: true,
      url: obj.value,
      title: obj.title,
      private: isPrivateWindowTitle(obj.title, this.privateMarkers),
    };
  }
}

const ERROR_CODES: ReadonlySet<string> = new Set<FirefoxAxErrorCode>([
  'permission-denied',
  'no-window',
  'field-not-found',
  'bad-invocation',
  'timeout',
  'unknown',
]);

function isFirefoxAxErrorCode(value: string): value is FirefoxAxErrorCode {
  return ERROR_CODES.has(value);
}
