const PRODUCTION_API_URL = 'https://api.hiday.io';
const DEV_API_URL = 'http://localhost:3001';

/**
 * `DESKTOP_API_URL` always wins when set (useful for pointing a local or
 * CI build at staging). Otherwise: a *packaged* app (an installed
 * .exe/.dmg/.AppImage) has no way to inherit a developer's shell env vars,
 * so it must default to the real production API, not localhost — `pnpm
 * dev`'s `electron .` is the only case that should ever fall back to a
 * local backend.
 */
export function resolveApiBaseUrl(
  isPackaged: boolean,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.DESKTOP_API_URL ?? (isPackaged ? PRODUCTION_API_URL : DEV_API_URL);
}
