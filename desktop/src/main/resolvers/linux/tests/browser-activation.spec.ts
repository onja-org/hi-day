import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ACTIVATION_FLAG,
  ACTIVATION_MARKER,
  LEGACY_ACTIVATION_MARKERS,
  activateDesktopEntry,
  activateExecValue,
  applicationDirectories,
  applyBrowserActivation,
  discoverBrowserEntries,
  isBrowserDesktopEntry,
  removeBrowserActivation,
} from '../browser-activation';

/** A trimmed copy of the real snap-packaged Brave entry, actions included. */
const BRAVE_ENTRY = [
  '[Desktop Entry]',
  'Name=Brave Web Browser',
  'Exec=/snap/bin/brave %U',
  'Terminal=false',
  'Type=Application',
  'MimeType=text/html;x-scheme-handler/http;x-scheme-handler/https;',
  'StartupWMClass=brave-browser',
  '',
  '[Desktop Action new-window]',
  'Name=New Window',
  'Exec=/snap/bin/brave',
  '',
  '[Desktop Action new-private-window]',
  'Name=New Private Window',
  'Exec=/snap/bin/brave --incognito',
].join('\n');

const TEXT_EDITOR_ENTRY = [
  '[Desktop Entry]',
  'Name=Text Editor',
  'Exec=/usr/bin/gedit %U',
  'Type=Application',
  'MimeType=text/plain;',
].join('\n');

const temporaryDirectories: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'activation-'));
  temporaryDirectories.push(dir);
  return dir;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const dir = temporaryDirectories.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('isBrowserDesktopEntry — identifying browsers without a browser list', () => {
  it('treats an http scheme handler as a browser', () => {
    expect(isBrowserDesktopEntry(BRAVE_ENTRY)).toBe(true);
  });

  it('rejects an application that handles files but not http', () => {
    expect(isBrowserDesktopEntry(TEXT_EDITOR_ENTRY)).toBe(false);
  });
});

describe('activateExecValue', () => {
  it('applies both levers, so no browser family has to be identified', () => {
    expect(activateExecValue('/snap/bin/brave %U')).toBe(
      `env GNOME_ACCESSIBILITY=1 /snap/bin/brave ${ACTIVATION_FLAG} %U`,
    );
  });

  it('inserts the flag before the field code, never after the URL', () => {
    const activated = activateExecValue('/usr/bin/google-chrome-stable %U');
    expect(activated.endsWith('%U')).toBe(true);
    expect(activated.indexOf(ACTIVATION_FLAG)).toBeLessThan(activated.indexOf('%U'));
  });

  it("keeps the entry's own arguments", () => {
    expect(activateExecValue('/snap/bin/brave --incognito')).toBe(
      `env GNOME_ACCESSIBILITY=1 /snap/bin/brave ${ACTIVATION_FLAG} --incognito`,
    );
  });

  it('is idempotent — re-running never stacks duplicate flags', () => {
    const once = activateExecValue('/snap/bin/brave %U');
    expect(activateExecValue(once)).toBe(once);
    expect(activateExecValue(activateExecValue(once))).toBe(once);
  });

  it('preserves an env prefix the entry already had', () => {
    const activated = activateExecValue('env MOZ_ENABLE_WAYLAND=1 /snap/bin/firefox %u');
    expect(activated).toBe(
      `env GNOME_ACCESSIBILITY=1 MOZ_ENABLE_WAYLAND=1 /snap/bin/firefox ${ACTIVATION_FLAG} %u`,
    );
    expect(activateExecValue(activated)).toBe(activated);
  });

  it('leaves an empty value alone rather than inventing a command', () => {
    expect(activateExecValue('')).toBe('');
  });
});

describe('activateDesktopEntry', () => {
  it('rewrites Desktop Action Exec lines too, so "New Private Window" is tracked', () => {
    const activated = activateDesktopEntry(BRAVE_ENTRY);
    const execLines = activated.split('\n').filter((line) => line.startsWith('Exec='));

    expect(execLines).toHaveLength(3);
    for (const line of execLines) {
      expect(line).toContain(ACTIVATION_FLAG);
      expect(line).toContain('GNOME_ACCESSIBILITY=1');
    }
  });

  it('leaves every non-Exec line untouched', () => {
    const activated = activateDesktopEntry(BRAVE_ENTRY);
    expect(activated).toContain('StartupWMClass=brave-browser');
    expect(activated).toContain('MimeType=text/html;x-scheme-handler/http;');
    expect(activated).toContain('[Desktop Action new-private-window]');
  });

  it('marks the file as ours so uninstall can tell it from a vendor entry', () => {
    expect(activateDesktopEntry(BRAVE_ENTRY)).toContain(ACTIVATION_MARKER);
  });

  it("doesn't add a second marker to an override written under the app's old name", () => {
    const legacy = `${LEGACY_ACTIVATION_MARKERS[0]}\n${BRAVE_ENTRY}`;
    const activated = activateDesktopEntry(legacy);
    expect(activated).not.toContain(ACTIVATION_MARKER);
    expect(activated).toContain(LEGACY_ACTIVATION_MARKERS[0]);
  });
});

describe('discoverBrowserEntries', () => {
  it('finds browsers and ignores everything else', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'brave_brave.desktop'), BRAVE_ENTRY);
    writeFileSync(join(dir, 'gedit.desktop'), TEXT_EDITOR_ENTRY);

    const found = discoverBrowserEntries([dir]);
    expect(found.map((entry) => entry.fileName)).toEqual(['brave_brave.desktop']);
  });

  it('never reads back its own overrides as if they were vendor entries', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'brave_brave.desktop'), activateDesktopEntry(BRAVE_ENTRY));
    expect(discoverBrowserEntries([dir])).toEqual([]);
  });

  it('lets a later directory win, matching XDG precedence', () => {
    const low = makeTempDir();
    const high = makeTempDir();
    writeFileSync(join(low, 'brave_brave.desktop'), BRAVE_ENTRY);
    writeFileSync(
      join(high, 'brave_brave.desktop'),
      BRAVE_ENTRY.replace('/snap/bin/brave %U', '/usr/bin/brave %U'),
    );

    const found = discoverBrowserEntries([low, high]);
    expect(found).toHaveLength(1);
    expect(found[0].contents).toContain('/usr/bin/brave %U');
  });

  it('skips a directory that does not exist rather than throwing', () => {
    expect(() => discoverBrowserEntries(['/definitely/not/here'])).not.toThrow();
  });
});

// These two suites exercise real filesystem paths built from XDG env vars
// (colon-delimited lists, `:`-split) against this Linux-only resolver's own
// path-joining. On Windows that collides with drive-letter colons (`C:\...`)
// and produces backslash-joined paths the assertions below (written as
// literal POSIX strings, matching the XDG spec these paths always take on
// the real, Linux-only runtime this module targets) never expect — a
// cross-platform-CI artifact, not a real difference in behavior, since this
// resolver only ever runs on Linux in the packaged app.
describe.skipIf(process.platform !== 'linux')('applicationDirectories', () => {
  it('orders XDG_DATA_DIRS first and the user directory last', () => {
    const dirs = applicationDirectories({
      XDG_DATA_DIRS: '/usr/share/:/var/lib/snapd/desktop',
      XDG_DATA_HOME: '/home/someone/.local/share',
    });

    expect(dirs).toEqual([
      '/usr/share/applications',
      '/var/lib/snapd/desktop/applications',
      '/home/someone/.local/share/applications',
    ]);
  });
});

describe.skipIf(process.platform !== 'linux')(
  'applyBrowserActivation / removeBrowserActivation',
  () => {
  function scenario(): { source: string; target: string; env: NodeJS.ProcessEnv } {
    // XDG_DATA_DIRS entries are data roots; the entries live in an
    // `applications/` subdirectory of each, which is what the code joins on.
    const dataRoot = makeTempDir();
    const home = makeTempDir();
    const source = join(dataRoot, 'applications');
    const target = join(home, 'applications');
    mkdirSync(source, { recursive: true });
    mkdirSync(target, { recursive: true });
    writeFileSync(join(source, 'brave_brave.desktop'), BRAVE_ENTRY);
    writeFileSync(join(source, 'gedit.desktop'), TEXT_EDITOR_ENTRY);
    return {
      source,
      target,
      env: { XDG_DATA_DIRS: dataRoot, XDG_DATA_HOME: home },
    };
  }

  it('writes an activated override for each browser, under the same filename', () => {
    const { target, env } = scenario();
    const report = applyBrowserActivation({ scope: 'user', env });

    expect(report.outcomes).toHaveLength(1);
    expect(report.outcomes[0]).toMatchObject({ fileName: 'brave_brave.desktop', activated: true });

    const written = readFileSync(join(target, 'brave_brave.desktop'), 'utf-8');
    expect(written).toContain(ACTIVATION_FLAG);
    expect(written).toContain(ACTIVATION_MARKER);
  });

  it('is safe to re-run at every startup', () => {
    const { target, env } = scenario();
    applyBrowserActivation({ scope: 'user', env });
    const first = readFileSync(join(target, 'brave_brave.desktop'), 'utf-8');

    applyBrowserActivation({ scope: 'user', env });
    expect(readFileSync(join(target, 'brave_brave.desktop'), 'utf-8')).toBe(first);
  });

  it('removes only its own files on uninstall', () => {
    const { target, env } = scenario();
    applyBrowserActivation({ scope: 'user', env });
    writeFileSync(join(target, 'someone-elses.desktop'), TEXT_EDITOR_ENTRY);

    const removed = removeBrowserActivation({ scope: 'user', env });

    expect(removed).toEqual([join(target, 'brave_brave.desktop')]);
    expect(readFileSync(join(target, 'someone-elses.desktop'), 'utf-8')).toBe(TEXT_EDITOR_ENTRY);
  });

  it("also removes overrides written under the app's old name on uninstall", () => {
    const { target, env } = scenario();
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'old.desktop'), `${LEGACY_ACTIVATION_MARKERS[0]}\n${BRAVE_ENTRY}`);

    const removed = removeBrowserActivation({ scope: 'user', env });

    expect(removed).toEqual([join(target, 'old.desktop')]);
  });

  it('reports a browser it could not activate instead of failing silently', () => {
    const dataRoot = makeTempDir();
    const source = join(dataRoot, 'applications');
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'brave_brave.desktop'), BRAVE_ENTRY);
    // An unwritable target, expressed as a regular FILE where the code
    // expects a directory, so mkdirSync fails immediately with EEXIST.
    // Deliberately not a /proc path: node's recursive mkdirSync hangs
    // forever on procfs instead of returning ENOENT the way mkdir(1) does,
    // which wedged this suite with no output at all.
    const blockedHome = makeTempDir();
    writeFileSync(join(blockedHome, 'applications'), 'not a directory');
    const env = {
      XDG_DATA_DIRS: dataRoot,
      XDG_DATA_HOME: blockedHome,
    } as NodeJS.ProcessEnv;

    const report = applyBrowserActivation({ scope: 'user', env });

    expect(report.outcomes).toHaveLength(1);
    expect(report.outcomes[0].activated).toBe(false);
    expect(report.outcomes[0].reason).toBeTruthy();
  });
  },
);

describe('activateExecValue — flatpak launchers', () => {
  /**
   * Pop!_Shop installs flatpaks. The generic rewrite handed the Chromium
   * flag to `flatpak` itself, which refuses to start on an unknown option,
   * so Opera stopped launching at all.
   */
  it('passes the flag to the application, not to flatpak', () => {
    const result = activateExecValue(
      '/usr/bin/flatpak run --branch=stable --arch=x86_64 com.opera.Opera %U',
    );

    const tokens = result.split(' ');
    expect(tokens.indexOf(ACTIVATION_FLAG)).toBeGreaterThan(tokens.indexOf('com.opera.Opera'));
    expect(tokens[tokens.indexOf('/usr/bin/flatpak') + 1]).not.toBe(ACTIVATION_FLAG);
  });

  it("uses flatpak's own --env, since a shell variable never enters the sandbox", () => {
    const result = activateExecValue('/usr/bin/flatpak run com.opera.Opera %U');

    expect(result).toContain('--env=GNOME_ACCESSIBILITY=1');
    expect(result.startsWith('env ')).toBe(false);
    const tokens = result.split(' ');
    expect(tokens.indexOf('--env=GNOME_ACCESSIBILITY=1')).toBeGreaterThan(tokens.indexOf('run'));
    expect(tokens.indexOf('--env=GNOME_ACCESSIBILITY=1')).toBeLessThan(
      tokens.indexOf('com.opera.Opera'),
    );
  });

  it('keeps flatpak run options ahead of the app id', () => {
    const result = activateExecValue(
      '/usr/bin/flatpak run --branch=stable --command=opera --file-forwarding com.opera.Opera @@u %U @@',
    );
    const tokens = result.split(' ');

    for (const option of ['--branch=stable', '--command=opera', '--file-forwarding']) {
      expect(tokens.indexOf(option)).toBeLessThan(tokens.indexOf('com.opera.Opera'));
    }
    expect(tokens.indexOf('@@u')).toBeGreaterThan(tokens.indexOf(ACTIVATION_FLAG));
  });

  it('is idempotent — a second run does not stack flags', () => {
    const once = activateExecValue('/usr/bin/flatpak run com.opera.Opera %U');
    expect(activateExecValue(once)).toBe(once);
  });

  it('leaves a non-flatpak launcher on the original path', () => {
    const result = activateExecValue('/usr/bin/google-chrome-stable %U');
    expect(result).toBe(
      `env GNOME_ACCESSIBILITY=1 /usr/bin/google-chrome-stable ${ACTIVATION_FLAG} %U`,
    );
  });
});
