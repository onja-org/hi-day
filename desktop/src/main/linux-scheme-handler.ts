import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { quoteExecPath, resolveLinuxExecutablePath } from './linux-autostart';

/** Marks a file as ours, same convention as AUTOSTART_MARKER. */
export const SCHEME_HANDLER_MARKER =
  '# Written by Hi Day to open hiday:// links.';

// Named after the app ID (electron-builder.yml's appId), suffixed so it
// never collides with the .deb's own /usr/share entry.
const SCHEME_HANDLER_FILE_NAME = 'io.hiday.app-url-handler.desktop';

export function schemeHandlerDirectory(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const dataHome = env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share');
  return join(dataHome, 'applications');
}

export function schemeHandlerFilePath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return join(schemeHandlerDirectory(env), SCHEME_HANDLER_FILE_NAME);
}

export function buildSchemeHandlerDesktopEntry(
  executablePath: string,
  scheme: string,
): string {
  return [
    SCHEME_HANDLER_MARKER,
    '[Desktop Entry]',
    'Type=Application',
    'Name=Hi Day',
    // %U passes the URL through — without it the app launches with no
    // argument and the link is silently dropped.
    `Exec=${quoteExecPath(executablePath)} --no-sandbox %U`,
    'Terminal=false',
    'StartupWMClass=hiday',
    // Hidden from menus: the launcher entry is the AppImage's own job, and
    // a second "Hi Day" in the app grid would just be confusing. NoDisplay
    // hides it from menus only — MIME association still works.
    'NoDisplay=true',
    `MimeType=x-scheme-handler/${scheme};`,
    '',
  ].join('\n');
}

/**
 * Claims `hiday://` for an AppImage, which a `.deb` gets for free from the
 * entry electron-builder installs into /usr/share/applications. An
 * AppImage's own desktop entry never leaves the image, so without this
 * nothing on the host knows the scheme exists and the web console's "Open
 * Hi Day" button does nothing. `app.setAsDefaultProtocolClient` is no help
 * on Linux — it shells out to xdg-settings, which needs an installed entry
 * of its own.
 *
 * Returns the directory to re-index, or null when there was nothing to do
 * — not an AppImage, or the entry is already exactly right. Idempotent and
 * safe on every launch, which it needs to be: a self-updated AppImage
 * resolves to a new $APPIMAGE path each run.
 */
export function registerAppImageSchemeHandler(
  scheme: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (process.platform !== 'linux' || !env.APPIMAGE) return null;

  const directory = schemeHandlerDirectory(env);
  const path = schemeHandlerFilePath(env);
  const entry = buildSchemeHandlerDesktopEntry(
    resolveLinuxExecutablePath(env),
    scheme,
  );

  try {
    if (readFileSync(path, 'utf-8') === entry) return null;
  } catch {
    // No entry yet, or unreadable — either way, write one.
  }

  mkdirSync(directory, { recursive: true });
  writeFileSync(path, entry, 'utf-8');
  return directory;
}
