import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AUTOSTART_MARKER,
  autostartDirectory,
  autostartFilePath,
  buildAutostartDesktopEntry,
  disableLinuxAutostart,
  enableLinuxAutostart,
  resolveLinuxExecutablePath,
} from '../linux-autostart';

describe('autostartDirectory / autostartFilePath', () => {
  it('defaults to ~/.config/autostart when XDG_CONFIG_HOME is unset', () => {
    // homedir() reads the real OS user record, not a passed env object
    // (same limitation applicationDirectories in browser-activation.ts
    // has), so this checks against the real home rather than a fake one.
    const env = {} as NodeJS.ProcessEnv;
    expect(autostartDirectory(env)).toBe(join(homedir(), '.config', 'autostart'));
  });

  it('honors XDG_CONFIG_HOME when set', () => {
    const env = { XDG_CONFIG_HOME: '/custom/config' } as NodeJS.ProcessEnv;
    expect(autostartDirectory(env)).toBe(join('/custom/config', 'autostart'));
    expect(autostartFilePath(env)).toBe(
      join('/custom/config', 'autostart', 'io.hiday.app.desktop'),
    );
  });
});

describe('resolveLinuxExecutablePath', () => {
  it('prefers $APPIMAGE, the one stable path across an AppImage remount', () => {
    const env = { APPIMAGE: '/home/alice/Downloads/hiday.AppImage' } as NodeJS.ProcessEnv;
    expect(resolveLinuxExecutablePath(env, '/tmp/.mount_xyz/hiday')).toBe(
      '/home/alice/Downloads/hiday.AppImage',
    );
  });

  it('falls back to the real execPath for a .deb install or dev run', () => {
    const env = {} as NodeJS.ProcessEnv;
    expect(resolveLinuxExecutablePath(env, '/opt/hiday/hiday')).toBe(
      '/opt/hiday/hiday',
    );
  });
});

describe('buildAutostartDesktopEntry', () => {
  it('marks the file as ours and points Exec at the given path', () => {
    const entry = buildAutostartDesktopEntry('/opt/hiday/hiday');
    expect(entry).toContain(AUTOSTART_MARKER);
    expect(entry).toContain('[Desktop Entry]');
    expect(entry).toContain('Exec=/opt/hiday/hiday');
    expect(entry).toContain('X-GNOME-Autostart-enabled=true');
  });

  it('quotes an Exec path containing whitespace', () => {
    const entry = buildAutostartDesktopEntry('/opt/Hi Day/hiday');
    expect(entry).toContain('Exec="/opt/Hi Day/hiday" --no-sandbox');
  });

  // Without it the entry is written, validates, and silently does
  // nothing: the binary aborts on startup wherever chrome-sandbox is not
  // SUID and unprivileged user namespaces are restricted.
  it('runs without the Chromium sandbox, which the launcher entries also do', () => {
    expect(buildAutostartDesktopEntry('/opt/hiday/hiday')).toContain(
      'Exec=/opt/hiday/hiday --no-sandbox',
    );
  });
});

describe('enableLinuxAutostart / disableLinuxAutostart', () => {
  let configHome: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    configHome = mkdtempSync(join(tmpdir(), 'desktop-linux-autostart-'));
    env = { XDG_CONFIG_HOME: configHome };
  });

  afterEach(() => {
    rmSync(configHome, { recursive: true, force: true });
  });

  it('writes a marked .desktop entry into the autostart directory', () => {
    enableLinuxAutostart(env, '/opt/hiday/hiday');

    const written = readFileSync(autostartFilePath(env), 'utf-8');
    expect(written).toContain(AUTOSTART_MARKER);
    expect(written).toContain('Exec=/opt/hiday/hiday');
  });

  it('is idempotent — a second call with a new execPath overwrites the first', () => {
    enableLinuxAutostart(env, '/tmp/.mount_old/hiday');
    enableLinuxAutostart(env, '/tmp/.mount_new/hiday');

    const written = readFileSync(autostartFilePath(env), 'utf-8');
    expect(written).toContain('Exec=/tmp/.mount_new/hiday');
    expect(written).not.toContain('.mount_old');
  });

  it('removes the entry it wrote', () => {
    enableLinuxAutostart(env, '/opt/hiday/hiday');
    disableLinuxAutostart(env);

    expect(() => readFileSync(autostartFilePath(env), 'utf-8')).toThrow();
  });

  it('never removes a .desktop file it did not write', () => {
    mkdirSync(autostartDirectory(env), { recursive: true });
    const foreignContents = '[Desktop Entry]\nName=Someone Else\nExec=/usr/bin/something\n';
    writeFileSync(autostartFilePath(env), foreignContents, 'utf-8');

    disableLinuxAutostart(env);

    expect(readFileSync(autostartFilePath(env), 'utf-8')).toBe(foreignContents);
  });

  it('does nothing when no entry exists yet', () => {
    expect(() => disableLinuxAutostart(env)).not.toThrow();
  });
});
