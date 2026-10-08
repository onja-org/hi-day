import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Typed, so the assertions below can read the command back off the call.
const spawn = vi.hoisted(() =>
  vi.fn<(command: string, args: string[], options: object) => { unref: () => void }>(
    () => ({ unref: vi.fn() }),
  ),
);
vi.mock('node:child_process', () => ({ spawn }));

import { BrowserRestartService } from '../browser-restart-service';

describe('BrowserRestartService.restart', () => {
  let dataHome: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    spawn.mockClear();
    dataHome = mkdtempSync(join(tmpdir(), 'desktop-browser-restart-'));
    mkdirSync(join(dataHome, 'applications'), { recursive: true });
    writeFileSync(
      join(dataHome, 'applications', 'google-chrome.desktop'),
      '[Desktop Entry]\nExec=/opt/google/chrome/chrome --force-renderer-accessibility=basic\n',
      'utf-8',
    );
    env = { XDG_DATA_HOME: dataHome };
  });

  afterEach(() => {
    rmSync(dataHome, { recursive: true, force: true });
  });

  function chrome(pid: number) {
    return {
      pid,
      command: 'chrome',
      executablePath: '/opt/google/chrome/chrome',
      cmdline: ['/opt/google/chrome/chrome'],
      desktopFileName: 'google-chrome.desktop',
    };
  }

  /**
   * The whole point of restarting from a *running* process: a browser the
   * person has closed must never be opened on their behalf. Nothing here
   * screens for that explicitly — it falls out of signalling the pid first
   * and only launching what we actually ended — so this pins the behaviour
   * against a refactor that reorders the two.
   */
  it('never launches a browser whose process is gone', async () => {
    const service = new BrowserRestartService({ env });
    // A pid that cannot be signalled, exactly as a closed browser's would be.
    const killed = vi
      .spyOn(process, 'kill')
      .mockImplementation(() => {
        throw new Error('ESRCH: no such process');
      });

    const outcomes = await service.restart([chrome(999_999)]);

    expect(spawn).not.toHaveBeenCalled();
    expect(outcomes[0].restarted).toBe(false);
    killed.mockRestore();
  });

  /**
   * Firefox saves its session on the way out and can outlast the grace
   * period. Relaunching then meets the profile lock the dying process still
   * holds, the new instance exits on the spot, and the person is left with
   * no browser at all — so it is reported rather than relaunched blind.
   */
  it('does not relaunch a browser that has not finished exiting', async () => {
    const service = new BrowserRestartService({ env, shutdownGraceMs: 300 });
    // Accepts the signal and then stays alive, as a slow shutdown does.
    const killed = vi.spyOn(process, 'kill').mockReturnValue(true);

    const outcomes = await service.restart([chrome(4242)]);

    expect(spawn).not.toHaveBeenCalled();
    expect(outcomes[0].restarted).toBe(false);
    expect(outcomes[0].reason).toContain('shutting down');
    killed.mockRestore();
  });

  // Nothing running means nothing to do — not "launch the default browser".
  it('launches nothing when given no browsers', async () => {
    const outcomes = await new BrowserRestartService({ env }).restart([]);

    expect(spawn).not.toHaveBeenCalled();
    expect(outcomes).toEqual([]);
  });

  it('relaunches a browser it managed to end', async () => {
    const service = new BrowserRestartService({ env });
    // Accepts the SIGTERM, then reports the process as gone so the grace
    // period ends immediately rather than waiting it out.
    let signalled = false;
    const killed = vi.spyOn(process, 'kill').mockImplementation(() => {
      if (!signalled) {
        signalled = true;
        return true;
      }
      throw new Error('ESRCH: no such process');
    });

    const outcomes = await service.restart([chrome(4242)]);

    expect(spawn).toHaveBeenCalledOnce();
    expect(spawn.mock.calls[0][0]).toBe('/opt/google/chrome/chrome');
    expect(outcomes[0].restarted).toBe(true);
    killed.mockRestore();
  });
});
