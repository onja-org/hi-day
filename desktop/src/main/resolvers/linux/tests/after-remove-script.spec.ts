import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACTIVATION_MARKER, LEGACY_ACTIVATION_MARKERS } from '../browser-activation';

/**
 * The uninstall cleanup runs as a shell script, because dpkg removal happens as
 * root while /opt is being deleted and the app cannot execute itself. That
 * leaves the marker duplicated in two languages, and a silent drift would mean
 * uninstall quietly stops cleaning up — every browser left starting with
 * accessibility forced on, with nothing to notice it.
 */
const script = readFileSync(
  join(__dirname, '../../../../../build/afterRemove.sh'),
  'utf-8',
);

describe('afterRemove.sh', () => {
  it('matches on the same marker browser-activation.ts writes', () => {
    expect(script).toContain(ACTIVATION_MARKER);
  });

  it("also cleans up overrides written under the app's old name", () => {
    for (const marker of LEGACY_ACTIVATION_MARKERS) {
      expect(script).toContain(marker);
    }
    expect(script).toMatch(/grep -qF "\$LEGACY_MARKER" "\$entry"/);
  });

  it('deletes only marked files, never every .desktop it finds', () => {
    // The guard is what stops an uninstall wiping launchers the user wrote or
    // a vendor shipped.
    expect(script).toMatch(/grep -qF "\$MARKER" "\$entry"/);
  });

  it('matches the marker anywhere, as browser-activation.ts does', () => {
    // browser-activation.ts uses contents.includes(ACTIVATION_MARKER). A
    // first-line-only check here would leave files behind that the app itself
    // considers its own.
    expect(script).not.toContain('head -n 1');
  });

  it('covers every user, since the overrides are per-home', () => {
    expect(script).toContain('/home/*');
    expect(script).toContain('.local/share/applications');
  });

  it('exits successfully, so a cleanup failure cannot block removal', () => {
    expect(script.trimEnd().endsWith('exit 0')).toBe(true);
  });
});

/**
 * Runs the real script, with its hardcoded scan roots pointed at a temp tree
 * so a test can never reach a real home. Everything else — the guard, the
 * marker matching, the deletion — is the shipped code.
 */
describe('afterRemove.sh, run for real', () => {
  let root: string;
  let apps: string;
  let runnable: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'after-remove-'));
    apps = join(root, 'home', 'someone', '.local', 'share', 'applications');
    mkdirSync(apps, { recursive: true });

    writeFileSync(
      join(apps, 'ours.desktop'),
      `${ACTIVATION_MARKER}\n[Desktop Entry]\nExec=/usr/bin/chrome\n`,
      'utf-8',
    );
    writeFileSync(
      join(apps, 'theirs.desktop'),
      '[Desktop Entry]\nExec=/usr/bin/chrome\n',
      'utf-8',
    );

    runnable = join(root, 'afterRemove.sh');
    writeFileSync(
      runnable,
      script.replace('/home/* /root', `${root}/home/* ${root}/nonexistent-root`),
      'utf-8',
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const run = (...args: string[]): void => {
    execFileSync('sh', [runnable, ...args], { stdio: 'ignore' });
  };

  const ours = (): boolean => existsSync(join(apps, 'ours.desktop'));
  const theirs = (): boolean => existsSync(join(apps, 'theirs.desktop'));

  it('removes its own overrides on a real uninstall', () => {
    run('remove');

    expect(ours()).toBe(false);
    // The whole point of matching on a marker.
    expect(theirs()).toBe(true);
  });

  it('removes them on purge too', () => {
    run('purge');

    expect(ours()).toBe(false);
  });

  /**
   * The reason the guard exists. dpkg calls postrm with these while the
   * package is being *replaced*, and deleting the overrides then orphans
   * every open browser window and stops URL tracking until the new version
   * launches — once per update, for every user.
   */
  it.each(['upgrade', 'failed-upgrade', 'abort-install', 'abort-upgrade', 'disappear'])(
    'leaves them alone on %s',
    (reason) => {
      run(reason);

      expect(ours()).toBe(true);
      expect(theirs()).toBe(true);
    },
  );

  it('treats a hand-run with no argument as a removal', () => {
    run();

    expect(ours()).toBe(false);
  });
});
