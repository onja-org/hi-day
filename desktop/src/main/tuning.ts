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
