import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIVATION_MARKER } from '../browser-activation';

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
