import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHROMIUM_GENERIC_KEY, lookupBrowser, loadBrowserRegistry } from '../browser-registry';

describe('loadBrowserRegistry', () => {
  it('loads the shipped registry and covers the required browsers', () => {
    const registry = loadBrowserRegistry();
    for (const key of ['chrome', 'edge', 'firefox', 'safari', 'brave', 'opera', 'vivaldi', 'arc', 'chromium-generic']) {
      expect(registry).toHaveProperty(key);
    }
  });

  it('throws on a malformed registry file rather than returning bad data', () => {
    const dir = mkdtempSync(join(tmpdir(), 'browser-registry-'));
    const filePath = join(dir, 'bad-registry.json');
    writeFileSync(filePath, JSON.stringify({ chrome: { family: 'chromium' } }), 'utf-8');

    expect(() => loadBrowserRegistry(filePath)).toThrow();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('lookupBrowser', () => {
  let registry: ReturnType<typeof loadBrowserRegistry>;

  beforeEach(() => {
    registry = loadBrowserRegistry();
  });

  it('finds a browser by its Windows process name', () => {
    const result = lookupBrowser(registry, 'win32', 'chrome.exe');
    expect(result.key).toBe('chrome');
  });

  it('finds a browser by its macOS bundle id', () => {
    const result = lookupBrowser(registry, 'darwin', 'com.apple.Safari');
    expect(result.key).toBe('safari');
  });

  it('finds a browser by its Linux process name', () => {
    const result = lookupBrowser(registry, 'linux', 'firefox');
    expect(result.key).toBe('firefox');
  });

  it('falls back to chromium-generic for an unknown browser', () => {
    const result = lookupBrowser(registry, 'win32', 'some-new-chromium-fork.exe');
    expect(result.key).toBe(CHROMIUM_GENERIC_KEY);
  });
});
