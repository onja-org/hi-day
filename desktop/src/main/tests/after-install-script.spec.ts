import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The install script is electron-builder's own with one block removed: the
 * one installing its generated AppArmor profile. That profile's *name*
 * becomes the process's AppArmor label, and a snap-confined browser may only
 * send accessibility signals to a peer labelled `unconfined` — so with it
 * installed, no snap Firefox or Opera window event ever reached us and their
 * URLs went unrecorded.
 *
 * Copying a vendor template means it can drift on an upgrade, so this pins
 * both halves: the block stays out, and the parts doing real work stay in.
 */
const script = readFileSync(
  join(__dirname, '../../../build/afterInstall.sh'),
  'utf-8',
);

/**
 * app-builder-lib's template. Searched for rather than addressed directly:
 * pnpm stores it under a content-hashed directory whose name changes with
 * every dependency bump, and a path that quietly stops resolving would turn
 * the drift check below into one that always passes.
 */
function vendorTemplate(): string | null {
  const store = join(__dirname, '../../../../node_modules/.pnpm');
  if (!existsSync(store)) return null;

  const pkg = readdirSync(store).find((name) =>
    name.startsWith('app-builder-lib@'),
  );
  if (pkg === undefined) return null;

  const path = join(
    store,
    pkg,
    'node_modules/app-builder-lib/templates/linux/after-install.tpl',
  );
  return existsSync(path) ? readFileSync(path, 'utf-8') : null;
}

describe('afterInstall.sh', () => {
  it('never installs an AppArmor profile', () => {
    expect(script).not.toContain('/etc/apparmor.d/${executable}"');
    expect(script).not.toMatch(/cp\s+-f\s+"\$APPARMOR_PROFILE_SOURCE"/);
    expect(script).not.toContain('apparmor_parser --replace');
  });

  /**
   * Removing the install is not enough on its own: a machine that already
   * ran an earlier version still carries the profile, and the label it
   * confers outlives the version that wrote it.
   */
  it('removes a profile an earlier version installed, under either name', () => {
    expect(script).toContain('/etc/apparmor.d/${executable}');
    // The app shipped under this name before the rename.
    expect(script).toContain('/etc/apparmor.d/workforce-monitor');
    expect(script).toContain('apparmor_parser --remove');
  });

  // Everything the template does besides AppArmor still has to happen.
  it.each([
    ['links the binary onto the path', 'update-alternatives --install'],
    ['sets the sandbox helper mode', 'chrome-sandbox'],
    ['refreshes the mime database', 'update-mime-database'],
    ['refreshes the desktop database', 'update-desktop-database'],
  ])('still %s', (_name, needle) => {
    expect(script).toContain(needle);
  });

  it('uses the placeholders electron-builder substitutes', () => {
    expect(script).toContain('${executable}');
    expect(script).toContain('${sanitizedProductName}');
  });

  /**
   * The guard against a silent upgrade: if the vendor template grows a step,
   * ours is missing it until someone looks. Compared on the lines that do
   * something, since comments and blank lines differ by design.
   */
  it('keeps every vendor step except the AppArmor block', () => {
    const vendor = vendorTemplate();
    // Not skipped silently: a template we cannot find is the one case where
    // this check would pass without checking anything.
    expect(vendor).not.toBeNull();
    if (vendor === null) return;

    const meaningful = (text: string) =>
      text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));

    const apparmorBlockStart = vendor.indexOf('# Install apparmor profile');
    expect(apparmorBlockStart).toBeGreaterThan(-1);
    const kept = meaningful(vendor.slice(0, apparmorBlockStart));
    const ours = new Set(meaningful(script));

    expect(kept.filter((line) => !ours.has(line))).toEqual([]);
  });
});
