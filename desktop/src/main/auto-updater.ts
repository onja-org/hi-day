import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { isNewerVersion } from './update-checker';

export type AutoUpdatePhase =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'downloaded'
  | 'unsupported';

export interface AutoUpdateState {
  phase: AutoUpdatePhase;
  latestVersion?: string;
  progressPercent?: number;
}

// Re-checks a few times a day rather than only once at launch — this app
// is meant to stay running for a full workday, and a person who never
// restarts it would otherwise never pick up a new release silently.
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let state: AutoUpdateState = { phase: 'idle' };

export function getAutoUpdateState(): AutoUpdateState {
  return withoutStaleUpdate(state, app.getVersion());
}

/**
 * A download/restart banner only makes sense for a version newer than the
 * one already running — anything else (the same version, or an older one)
 * is reported as idle so the renderer hides the banner.
 */
export function withoutStaleUpdate(
  current: AutoUpdateState,
  currentVersion: string,
): AutoUpdateState {
  if (
    (current.phase === 'downloading' || current.phase === 'downloaded') &&
    current.latestVersion !== undefined &&
    !isNewerVersion(currentVersion, current.latestVersion)
  ) {
    return { phase: 'idle' };
  }
  return current;
}

/**
 * electron-updater's silent download-and-install flow needs a validly
 * signed app to apply the update at all on macOS (Squirrel.Mac refuses to
 * replace an unsigned bundle) — this app isn't code-signed yet (see
 * README's Known limitations), so macOS never even attempts it and keeps
 * using the existing manual "View update" banner (update-checker.ts)
 * instead. Linux only supports this while actually running from the
 * AppImage build (electron-updater has no self-update path for a `.deb`
 * install) — that distinction isn't knowable ahead of the first real
 * `checkForUpdates()` call, so it surfaces as an ordinary error there,
 * handled the same as any other "can't self-update here" case.
 */
export function supportsSilentAutoUpdate(platform: NodeJS.Platform): boolean {
  return platform === 'win32' || platform === 'linux';
}

/**
 * Wires electron-updater's own event stream into `state`, so the renderer
 * can poll a single `update:autoStatus` IPC call instead of the main
 * process pushing events across the bridge. Never runs in dev — there is
 * no packaged `app-update.yml` for electron-updater to read outside a real
 * `dist:*` build, and it throws immediately without one.
 *
 * Safety is inherited from electron-updater itself: a downloaded update is
 * verified against the sha512 in the release's `latest*.yml` before it is
 * ever applied, and nothing about the currently-running install is touched
 * until that check passes — a corrupt or tampered download is simply
 * discarded, never installed. Rolling back a release that passed that
 * check but turns out to be broken is a release-management concern (cut a
 * new, higher-numbered release), not something the client can do on its
 * own — electron-updater has no "revert to the previous version" feature.
 */
export function startAutoUpdater(logger: (line: string) => void): void {
  if (!app.isPackaged) return;

  if (!supportsSilentAutoUpdate(process.platform)) {
    state = { phase: 'unsupported' };
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: logger,
    warn: logger,
    error: logger,
    debug: () => {},
  };

  autoUpdater.on('checking-for-update', () => {
    state = { phase: 'checking' };
  });

  autoUpdater.on('update-available', (info) => {
    state = { phase: 'downloading', latestVersion: info.version, progressPercent: 0 };
  });

  autoUpdater.on('update-not-available', () => {
    state = { phase: 'idle' };
  });

  autoUpdater.on('download-progress', (progress) => {
    state = {
      phase: 'downloading',
      latestVersion: state.latestVersion,
      progressPercent: Math.round(progress.percent),
    };
  });

  autoUpdater.on('update-downloaded', (info) => {
    state = { phase: 'downloaded', latestVersion: info.version };
  });

  autoUpdater.on('error', (error) => {
    // Covers both a genuinely unsupported install (unsigned macOS slipping
    // through, a non-AppImage Linux install) and an ordinary transient
    // failure (offline, GitHub unreachable) — either way there is nothing
    // actionable to show the person here; the renderer's existing manual
    // banner (checkForUpdate) is the fallback for both.
    state = { phase: 'unsupported' };
    logger(`[auto-update] ${error.message}`);
  });

  const check = (): void => {
    void autoUpdater.checkForUpdates().catch((error: unknown) => {
      state = { phase: 'unsupported' };
      logger(`[auto-update] check failed: ${String(error)}`);
    });
  };
  check();
  setInterval(check, CHECK_INTERVAL_MS);
}

/**
 * A check asked for by hand (the tray's "Check for updates…"), settled
 * before it returns: electron-updater announces what it found before its
 * promise resolves, so `state` already says whether a download began.
 */
export async function checkForUpdatesNow(): Promise<AutoUpdateState> {
  if (!app.isPackaged || state.phase === 'unsupported') return getAutoUpdateState();
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    state = { phase: 'unsupported' };
  }
  return getAutoUpdateState();
}

/** Only meaningful once `state.phase === 'downloaded'`; quits and relaunches into the new version. */
export function restartToApplyUpdate(): void {
  autoUpdater.quitAndInstall();
}
