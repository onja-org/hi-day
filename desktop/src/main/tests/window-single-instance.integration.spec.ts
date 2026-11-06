import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Launches the real app, twice, and counts the windows it opens.
 *
 * A second launch lands on `second-instance`, which fires from the moment
 * the process starts — while startup may still be awaiting
 * `registerIpcHandlers`. Reaching `createWindow` from there used to assign
 * over `mainWindow`, so startup's own window a moment later orphaned the
 * one already on screen: two Hi Days, two clocks, seconds apart, with only
 * the later one receiving the idle prompt.
 *
 * Needs a built `dist/` and a display, so it is opt-in rather than part of
 * the normal run:
 *
 *   pnpm build
 *   RUN_ELECTRON_INTEGRATION=1 pnpm test window-single-instance
 *
 * `WM_STARTUP_WINDOW_DELAY_MS` holds the first window back so the second
 * launch lands inside the gap every time; without it the gap is ~160ms on
 * a developer machine and the race is luck.
 */
const shouldRun =
  process.env.RUN_ELECTRON_INTEGRATION === '1' && process.platform !== 'win32';

const STARTUP_DELAY_MS = 3_000;
const electronBinary = join(__dirname, '..', '..', '..', 'node_modules', '.bin', 'electron');
const appRoot = join(__dirname, '..', '..', '..');

describe.skipIf(!shouldRun)('only ever one window', () => {
  const started: ChildProcess[] = [];
  let profile: string | null = null;

  afterEach(async () => {
    for (const child of started) child.kill('SIGTERM');
    started.length = 0;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    if (profile) rmSync(profile, { recursive: true, force: true });
    profile = null;
  });

  function launch(userDataDir: string, collect?: (line: string) => void): ChildProcess {
    const child = spawn(
      electronBinary,
      [appRoot, '--no-sandbox', `--user-data-dir=${userDataDir}`],
      { env: { ...process.env, WM_STARTUP_WINDOW_DELAY_MS: String(STARTUP_DELAY_MS) } },
    );
    child.stdout.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => collect?.(chunk));
    started.push(child);
    return child;
  }

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  it('opens one window when a second launch races startup', async () => {
    profile = mkdtempSync(join(tmpdir(), 'hiday-profile-'));
    let output = '';
    launch(profile, (chunk) => {
      output += chunk;
    });

    // Inside the gap: after the app is ready, before its window exists.
    await wait(1_200);
    launch(profile);

    await wait(STARTUP_DELAY_MS + 5_000);

    expect(output).toContain('[window] opened');
    expect(output.match(/\[window\] opened/g)).toHaveLength(1);
  }, 30_000);

  it('raises the window it has when a second launch arrives after startup', async () => {
    profile = mkdtempSync(join(tmpdir(), 'hiday-profile-'));
    let output = '';
    launch(profile, (chunk) => {
      output += chunk;
    });

    await wait(STARTUP_DELAY_MS + 5_000);
    expect(output.match(/\[window\] opened/g)).toHaveLength(1);

    launch(profile);
    await wait(5_000);

    expect(output.match(/\[window\] opened/g)).toHaveLength(1);
  }, 30_000);
});
