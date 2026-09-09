import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChromiumOutput, parseSafariOutput } from '../apple-events';
import { classifyAppleEventsFailure } from '../errors';

// All fixtures here are SYNTHETIC — constructed from documented, stable
// AppleScript/macOS error numbers and our own custom guard-check markers,
// not captured from a real browser (no Mac available — see the plan
// discussion). Replace with real captured output once Stage B reaches
// actual hardware, per docs/url-tracking-plan.md Step 21's fixture note.
const fixturesDir = join(__dirname, 'fixtures');

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('parseChromiumOutput', () => {
  it('parses a normal (non-incognito) window', () => {
    const result = parseChromiumOutput(fixture('chromium-normal.txt'));
    expect(result).toEqual({
      ok: true,
      url: 'https://example.com/page',
      title: 'Example Page',
      private: false,
    });
  });

  it('parses an incognito window as private: true', () => {
    const result = parseChromiumOutput(fixture('chromium-incognito.txt'));
    expect(result).toEqual({
      ok: true,
      url: 'https://example.com/page',
      title: 'Example Page',
      private: true,
    });
  });

  it('fails distinctly on an unexpected number of fields', () => {
    const result = parseChromiumOutput('only-one-field');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknown');
  });
});

describe('parseSafariOutput', () => {
  it('parses a window and always reports private: null (no signal exists)', () => {
    const result = parseSafariOutput(fixture('safari-normal.txt'));
    expect(result).toEqual({
      ok: true,
      url: 'https://example.com/page',
      title: 'Example Page',
      private: null,
    });
  });
});

describe('classifyAppleEventsFailure', () => {
  it('classifies TCC consent denial (-1743)', () => {
    const result = classifyAppleEventsFailure(fixture('stderr-consent-denied.txt'), false);
    expect(result.code).toBe('consent-denied');
  });

  it('classifies our own no-window guard marker', () => {
    const result = classifyAppleEventsFailure(fixture('stderr-no-window.txt'), false);
    expect(result.code).toBe('no-window');
  });

  it('classifies our own not-running guard marker', () => {
    const result = classifyAppleEventsFailure(fixture('stderr-not-running.txt'), false);
    expect(result.code).toBe('not-running');
  });

  it('classifies our own not-frontmost guard marker', () => {
    const result = classifyAppleEventsFailure(fixture('stderr-not-frontmost.txt'), false);
    expect(result.code).toBe('not-frontmost');
  });

  it('classifies an unsupported-dictionary error (-1708)', () => {
    const result = classifyAppleEventsFailure(fixture('stderr-unsupported-dictionary.txt'), false);
    expect(result.code).toBe('unsupported-dictionary');
  });

  it('classifies a timeout regardless of stderr content', () => {
    const result = classifyAppleEventsFailure('', true);
    expect(result.code).toBe('timeout');
  });

  it('falls back to unknown for unrecognized stderr text', () => {
    const result = classifyAppleEventsFailure('some completely unexpected failure text', false);
    expect(result.code).toBe('unknown');
  });
});
