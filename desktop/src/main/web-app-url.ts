/**
 * Where the web app lives, for the tray's dashboard item. Taken from the
 * origin of a pairing link rather than a constant beside
 * `api-base-url.ts`'s: the server builds those from its own
 * `FRONTEND_URL`, so it is the deployment's own answer and there is no
 * second value to keep in step at release time.
 *
 * Pairing happens once, though, so an install that paired before this
 * existed has nothing remembered — hence the dev fallback.
 */
const DEV_WEB_URL = 'http://localhost:3000';

export function resolveWebAppUrl(
  isPackaged: boolean,
  /** The origin learned from a pairing link, if this install has paired. */
  remembered: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (env.DESKTOP_WEB_URL) return env.DESKTOP_WEB_URL;
  if (remembered) return remembered;
  // No guessing from a packaged build: a wrong link in the tray is worse
  // than none, and it learns the real one at the next pairing.
  return isPackaged ? null : DEV_WEB_URL;
}
