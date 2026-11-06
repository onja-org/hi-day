/**
 * Reads a capture interval from the environment, defaulting to the
 * production cadence.
 *
 * Overridable only so testing need not wait out the 5-minute segment flush.
 * Lowering the defaults would mean more uploads and more fragmented
 * sessions, so they stay as they are.
 */
export function intervalFromEnv(
  name: string,
  defaultMs: number,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env[name];
  if (raw === undefined) return defaultMs;

  const parsed = Number(raw);
  // A typo must not disable an interval or spin the loop flat out.
  if (!Number.isFinite(parsed) || parsed < 100) return defaultMs;
  return parsed;
}

/**
 * Whether to behave as though the server cannot be reached, however good
 * the connection is. Development only, and off unless `WM_SIMULATE_OFFLINE`
 * is set to `1` or `true`.
 *
 * Offline is a supported state now rather than a broken one
 * (docs/adr/0025-...), and the cases worth testing — settings a week
 * stale, hours replayed and refused, a crash in the middle of an outage —
 * are all but unreachable by unplugging a cable at the right moment.
 * `ApiClient` reads this in front of every request, so what it produces is
 * the real thing: a transport failure, with no HTTP status, everywhere at
 * once.
 */
export function offlineSimulated(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.WM_SIMULATE_OFFLINE;
  return raw === '1' || raw === 'true';
}

/**
 * Holds the first window back by this many milliseconds, so a test can land
 * a second launch inside the gap between the app becoming ready and its
 * window existing. That gap is where duplicate windows came from, and it is
 * normally too short to aim at by hand — 161ms on a developer machine with
 * an empty profile, seconds on a device with a full offline queue.
 *
 * Zero unless asked for, and ignored in a packaged build, so nothing a
 * person installs can be slowed down by it.
 */
export function startupWindowDelayMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const parsed = Number(env.WM_STARTUP_WINDOW_DELAY_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, 30_000);
}
