/**
 * Where the web app lives, for the tray's dashboard item.
 *
 * Deliberately not a constant beside `api-base-url.ts`'s. The server
 * already builds its pairing links from its own `FRONTEND_URL`, so the
 * origin of one of those is the deployment's own answer — no second
 * value to keep in step at release time, and right for whichever backend
 * this install talks to.
 *
 * The catch is that pairing happens once. An install that paired before
 * this existed has nothing remembered, which is why dev mode falls back
 * to the frontend's own default port rather than showing nothing: a
 * developer should not have to sign out and back in to see the item.
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
  // A packaged build has no business guessing: an installed app cannot
  // inherit a developer's shell, and a wrong link in the tray is worse
  // than no link. It learns the real one the next time anybody pairs.
  return isPackaged ? null : DEV_WEB_URL;
}
