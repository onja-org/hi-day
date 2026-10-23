import type { AutoUpdateState } from './auto-updater';
import type { UpdateCheckResult } from './update-checker';

/** What a check asked for from the tray found. */
export type ManualUpdateOutcome =
  | { kind: 'downloaded'; version?: string }
  | { kind: 'downloading'; version?: string; percent?: number }
  /** Newer, but this install cannot fetch it itself (macOS, a `.deb`). */
  | { kind: 'available'; version: string }
  | { kind: 'none' };

/**
 * Asks whichever updater this install has. Where electron-updater runs,
 * its own state is the answer — it downloads on its own once it finds
 * something. Anywhere it does not (macOS, dev, a `.deb` install, which
 * reports `unsupported` after its first failed check), the releases page
 * is the fallback, as for the window's update banner.
 */
export async function manualUpdateOutcome(
  autoState: AutoUpdateState,
  silentUpdates: boolean,
  checkSilently: () => Promise<AutoUpdateState>,
  checkReleases: () => Promise<UpdateCheckResult>,
): Promise<ManualUpdateOutcome> {
  let state = autoState;
  if (silentUpdates && (state.phase === 'idle' || state.phase === 'checking')) {
    state = await checkSilently();
  }
  if (state.phase === 'downloaded') {
    return { kind: 'downloaded', version: state.latestVersion };
  }
  if (state.phase === 'downloading') {
    return {
      kind: 'downloading',
      version: state.latestVersion,
      percent: state.progressPercent,
    };
  }
  if (silentUpdates && state.phase !== 'unsupported') return { kind: 'none' };

  const release = await checkReleases();
  return release.updateAvailable && release.latestVersion
    ? { kind: 'available', version: release.latestVersion }
    : { kind: 'none' };
}

export interface UpdateDialog {
  message: string;
  detail: string;
  buttons: string[];
  /** What pressing the first button does, when it does more than close. */
  action?: 'restart' | 'openReleases';
}

export function updateDialogFor(
  outcome: ManualUpdateOutcome,
  currentVersion: string,
): UpdateDialog {
  const named = (version?: string): string =>
    version ? `Hi Day ${version}` : 'An update';
  switch (outcome.kind) {
    case 'downloaded':
      return {
        message: `${named(outcome.version)} is ready to install`,
        detail:
          'Restart now to finish updating, or it installs the next time Hi Day quits.',
        buttons: ['Restart now', 'Later'],
        action: 'restart',
      };
    case 'downloading':
      return {
        message: `Downloading ${named(outcome.version)}`,
        detail:
          outcome.percent !== undefined
            ? `${outcome.percent}% done. It installs the next time Hi Day restarts.`
            : 'It installs the next time Hi Day restarts.',
        buttons: ['OK'],
      };
    case 'available':
      return {
        message: `Hi Day ${outcome.version} is available`,
        detail: `You have ${currentVersion}. Download the new version from the releases page.`,
        buttons: ['Download', 'Later'],
        action: 'openReleases',
      };
    case 'none':
      // Not "up to date": an offline check reports nothing found too,
      // and only one of those two is true.
      return {
        message: 'No newer version found',
        detail: `You have Hi Day ${currentVersion}.`,
        buttons: ['OK'],
      };
  }
}
