import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadBrowserRegistry } from '../../../url-capture/browser-registry';
import { InstalledBrowserDetector } from '../installed-browsers';

const fakeMdfindPath = join(__dirname, 'fake-mdfind.mjs');

function makeDetector(): InstalledBrowserDetector {
  return new InstalledBrowserDetector({ command: fakeMdfindPath });
}

describe('InstalledBrowserDetector', () => {
  it('reports an installed bundle id as installed', async () => {
    const detector = makeDetector();
    expect(await detector.isInstalled('com.google.Chrome')).toBe(true);
  });

  it('reports a non-installed bundle id as not installed', async () => {
    const detector = makeDetector();
    expect(await detector.isInstalled('com.example.NotInstalled')).toBe(false);
  });

  it('detectInstalled checks every registry entry with a darwin bundle id, returning only installed keys', async () => {
    const detector = makeDetector();
    const registry = loadBrowserRegistry();
    const installed = await detector.detectInstalled(registry);

    // The real registry has chrome and safari with darwin bundle ids
    // matching the fake's "installed" list — every other entry with a
    // darwin bundle id (edge, brave, opera, vivaldi, arc, firefox) gets
    // checked too and correctly comes back not installed; chromium-generic
    // has no darwin bundle id at all and must be skipped, not crash.
    expect(installed.sort()).toEqual(['chrome', 'safari']);
  });
});
