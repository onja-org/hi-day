import { describe, expect, it, vi } from 'vitest';
import type { AutoUpdateState } from '../auto-updater';
import { manualUpdateOutcome, updateDialogFor } from '../update-check-dialog';

const releases = (latestVersion?: string) =>
  vi.fn(() =>
    Promise.resolve(
      latestVersion
        ? { updateAvailable: true, latestVersion }
        : { updateAvailable: false },
    ),
  );
const silently = (state: AutoUpdateState) => vi.fn(() => Promise.resolve(state));

describe('checking for updates from the tray', () => {
  it('asks electron-updater where it runs, and reports the download it began', async () => {
    const checkSilently = silently({ phase: 'downloading', latestVersion: '1.4.0', progressPercent: 0 });
    const checkReleases = releases('1.4.0');

    await expect(
      manualUpdateOutcome({ phase: 'idle' }, true, checkSilently, checkReleases),
    ).resolves.toEqual({ kind: 'downloading', version: '1.4.0', percent: 0 });
    expect(checkReleases).not.toHaveBeenCalled();
  });

  it('does not check again for an update already downloaded', async () => {
    const checkSilently = silently({ phase: 'idle' });

    await expect(
      manualUpdateOutcome(
        { phase: 'downloaded', latestVersion: '1.4.0' },
        true,
        checkSilently,
        releases(),
      ),
    ).resolves.toEqual({ kind: 'downloaded', version: '1.4.0' });
    expect(checkSilently).not.toHaveBeenCalled();
  });

  it('finds nothing when electron-updater finds nothing', async () => {
    await expect(
      manualUpdateOutcome({ phase: 'idle' }, true, silently({ phase: 'idle' }), releases('9.9.9')),
    ).resolves.toEqual({ kind: 'none' });
  });

  // A `.deb` install: electron-updater fails its first check and says so.
  it('falls back to the releases page where electron-updater cannot update', async () => {
    await expect(
      manualUpdateOutcome(
        { phase: 'idle' },
        true,
        silently({ phase: 'unsupported' }),
        releases('1.4.0'),
      ),
    ).resolves.toEqual({ kind: 'available', version: '1.4.0' });
  });

  // macOS, and dev.
  it('uses only the releases page where silent updates are off', async () => {
    const checkSilently = silently({ phase: 'idle' });

    await expect(
      manualUpdateOutcome({ phase: 'unsupported' }, false, checkSilently, releases()),
    ).resolves.toEqual({ kind: 'none' });
    expect(checkSilently).not.toHaveBeenCalled();
  });
});

describe('what the update dialog says', () => {
  it('offers a restart for a downloaded update', () => {
    expect(updateDialogFor({ kind: 'downloaded', version: '1.4.0' }, '1.3.0')).toMatchObject({
      message: 'Hi Day 1.4.0 is ready to install',
      buttons: ['Restart now', 'Later'],
      action: 'restart',
    });
  });

  it('shows how far a download has got', () => {
    const dialog = updateDialogFor({ kind: 'downloading', version: '1.4.0', percent: 42 }, '1.3.0');
    expect(dialog.message).toBe('Downloading Hi Day 1.4.0');
    expect(dialog.detail).toMatch(/^42% done/);
    expect(dialog.action).toBeUndefined();
  });

  it('sends a manual install to the releases page', () => {
    expect(updateDialogFor({ kind: 'available', version: '1.4.0' }, '1.3.0')).toMatchObject({
      message: 'Hi Day 1.4.0 is available',
      buttons: ['Download', 'Later'],
      action: 'openReleases',
    });
  });

  // An offline check finds nothing too, so this never claims "up to date".
  it('names the running version when nothing newer turned up', () => {
    expect(updateDialogFor({ kind: 'none' }, '1.3.0')).toEqual({
      message: 'No newer version found',
      detail: 'You have Hi Day 1.3.0.',
      buttons: ['OK'],
    });
  });
});
