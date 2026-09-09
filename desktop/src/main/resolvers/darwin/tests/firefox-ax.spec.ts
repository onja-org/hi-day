import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FirefoxAxResolver } from '../firefox-ax';

const fakeBinaryPath = join(__dirname, 'fake-firefox-ax-helper.mjs');

function makeResolver(timeoutMs?: number): FirefoxAxResolver {
  return new FirefoxAxResolver({ binaryPath: fakeBinaryPath, timeoutMs });
}

describe('FirefoxAxResolver — checkPermission', () => {
  it('reports granted without prompting', async () => {
    const resolver = makeResolver();
    expect(await resolver.checkPermission()).toBe(true);
  });
});

describe('FirefoxAxResolver — resolve', () => {
  it('resolves a normal (non-private) window', async () => {
    const resolver = makeResolver();
    const result = await resolver.resolve(1);
    expect(result).toEqual({
      ok: true,
      url: 'https://example.com/page',
      title: 'Example Page — Mozilla Firefox',
      private: false,
    });
  });

  it('detects a private window via the title marker table', async () => {
    const resolver = makeResolver();
    const result = await resolver.resolve(2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.private).toBe(true);
  });

  it('surfaces permission-denied as a typed error, not a crash', async () => {
    const resolver = makeResolver();
    const result = await resolver.resolve(3);
    expect(result).toEqual({
      ok: false,
      error: { code: 'permission-denied', message: 'Accessibility permission has not been granted.' },
    });
  });

  it('surfaces no-window as a typed error', async () => {
    const resolver = makeResolver();
    const result = await resolver.resolve(4);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('no-window');
  });

  it('times out and reports a typed timeout error, not a hang', async () => {
    const resolver = makeResolver(150);
    const result = await resolver.resolve(5);
    expect(result).toEqual({
      ok: false,
      error: { code: 'timeout', message: 'firefox-ax-helper did not complete within the deadline.' },
    });
  });

  it('handles malformed (non-JSON) output as a typed error', async () => {
    const resolver = makeResolver();
    const result = await resolver.resolve(6);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknown');
  });
});
