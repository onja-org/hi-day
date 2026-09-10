import { describe, expect, it } from 'vitest';
import { normalizeAddressBarReading } from '../normalize';
import { loadPlaceholders, loadSensitivePathPatterns } from '../denylists';

// Loaded once and injected explicitly rather than relying on each call's
// own default file read — makes it obvious these tests exercise the real
// shipped config files, not an assumption about their contents.
const placeholders = loadPlaceholders();
const sensitivePathPatterns = loadSensitivePathPatterns();

function normalize(raw: string, queryStringPolicy: 'strip' | 'keep' = 'strip') {
  return normalizeAddressBarReading(raw, { queryStringPolicy, placeholders, sensitivePathPatterns });
}

describe('normalizeAddressBarReading — accepted readings', () => {
  it('accepts a plain host with a path', () => {
    expect(normalize('example.com/a/b')).toEqual({ ok: true, url: 'https://example.com/a/b', host: 'example.com', path: '/a/b' });
  });

  it('accepts a bare host with no path', () => {
    expect(normalize('example.com')).toEqual({ ok: true, url: 'https://example.com', host: 'example.com', path: null });
  });

  it('assumes https and lowercases the host', () => {
    expect(normalize('Example.COM')).toEqual({ ok: true, url: 'https://example.com', host: 'example.com', path: null });
  });

  it('strips the default port for the assumed https scheme', () => {
    // Address bars don't show :443 for a plain https site, but a resolver
    // could conceivably hand back a fuller string — canonicalization must
    // not treat "same site, port spelled out" as a different session.
    expect(normalize('https://example.com:443/a')).toEqual({ ok: true, url: 'https://example.com/a', host: 'example.com', path: '/a' });
  });

  it('strips the fragment always, regardless of query policy', () => {
    expect(normalize('example.com/a#section-2')).toEqual({ ok: true, url: 'https://example.com/a', host: 'example.com', path: '/a' });
  });

  it('strips the query string by default (decision D1)', () => {
    expect(normalize('example.com/search?q=shoes')).toEqual({ ok: true, url: 'https://example.com/search', host: 'example.com', path: '/search' });
  });

  it('keeps the query string when policy is "keep"', () => {
    expect(normalize('example.com/search?q=shoes', 'keep')).toEqual({
      ok: true,
      url: 'https://example.com/search?q=shoes',
      host: 'example.com',
      path: '/search?q=shoes',
    });
  });

  it('accepts an IDN host, storing its punycode form', () => {
    // Punycode (not raw Unicode) is the canonical, ASCII-safe, unambiguous
    // storage form — WHATWG URL's own hostname getter already does this
    // conversion; storing anything else would risk homograph confusion.
    expect(normalize('münchen.de/a')).toEqual({
      ok: true,
      url: 'https://xn--mnchen-3ya.de/a',
      host: 'xn--mnchen-3ya.de',
      path: '/a',
    });
  });

  it('accepts an IPv4 literal', () => {
    expect(normalize('192.168.1.1/status')).toEqual({ ok: true, url: 'https://192.168.1.1/status', host: '192.168.1.1', path: '/status' });
  });

  it('accepts an IPv6 literal, keeping its (non-default) port', () => {
    const result = normalize('[::1]:8080/status');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.host).toBe('[::1]:8080');
      expect(result.path).toBe('/status');
    }
  });

  it('accepts localhost with a port, keeping the (non-default) port', () => {
    const result = normalize('localhost:3000/app');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.host).toBe('localhost:3000');
      expect(result.path).toBe('/app');
    }
  });

  it('accepts a chrome:// internal page, preserving its own scheme', () => {
    expect(normalize('chrome://settings/passwords')).toEqual({
      ok: true,
      url: 'chrome://settings/passwords',
      host: 'settings',
      path: '/passwords',
    });
  });

  it('accepts a file:// URL, grouped under a synthetic host', () => {
    const result = normalize('file:///C:/Users/x/report.pdf');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.host).toBe('file');
      expect(result.url.startsWith('file://')).toBe(true);
    }
  });

  it('truncates the path at 512 characters', () => {
    const longPath = '/' + 'a'.repeat(600);
    const result = normalize(`example.com${longPath}`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path?.length).toBe(512);
    }
  });
});

describe('normalizeAddressBarReading — rejected readings', () => {
  it('rejects a half-typed search query', () => {
    expect(normalize('how do I center a div in css')).toEqual({ ok: false, reason: 'contains-space' });
  });

  it('rejects a search phrase that happens to contain a dot', () => {
    expect(normalize('what does mr. smith do for a living')).toEqual({ ok: false, reason: 'contains-space' });
  });

  it('rejects a "N tabs" chip', () => {
    expect(normalize('3 tabs')).toEqual({ ok: false, reason: 'contains-space' });
  });

  it('rejects a bare single-label word with no dot', () => {
    expect(normalize('settings')).toEqual({ ok: false, reason: 'invalid-host' });
  });

  it('rejects the empty string', () => {
    expect(normalize('')).toEqual({ ok: false, reason: 'invalid-host' });
  });

  it('rejects about:blank as a known placeholder', () => {
    expect(normalize('about:blank')).toEqual({ ok: false, reason: 'placeholder' });
  });

  it('rejects "New Tab" — caught by the space check before ever reaching the placeholder list', () => {
    // Matches Step 21's own listed rule order (spaces rejected at rule 2,
    // before placeholders at rule 4): "New Tab" has a space, so it's
    // already rejected before the placeholder list is even consulted.
    // The "new tab"/"nouvel onglet" placeholder-list entries exist as a
    // backstop for if that ordering or the space check ever changes, not
    // because they're expected to be the active rejection path today.
    expect(normalize('New Tab')).toEqual({ ok: false, reason: 'contains-space' });
    expect(normalize('Nouvel onglet')).toEqual({ ok: false, reason: 'contains-space' });
  });

  it('rejects chrome://newtab as a known placeholder — the real path that list entry serves', () => {
    // Unlike "New Tab" (has a space), this has no space and passes host
    // validation (a recognized internal scheme) — so it genuinely reaches
    // and is caught by the placeholder check, unlike the space-delimited
    // localized variants above.
    expect(normalize('chrome://newtab')).toEqual({ ok: false, reason: 'placeholder' });
  });

  it('rejects a password-reset path even though the host is valid', () => {
    expect(normalize('example.com/account/reset-password?token=abc123')).toEqual({ ok: false, reason: 'sensitive-path' });
  });

  it('rejects a token-bearing query even under the default strip policy', () => {
    // The regression this specifically guards: if the denylist check ran
    // AFTER query stripping, this would incorrectly pass through as a
    // plain "example.com/callback" reading instead of being rejected.
    expect(normalize('example.com/oauth/callback?access_token=xyz')).toEqual({ ok: false, reason: 'sensitive-path' });
  });

  it('rejects an unsubscribe link', () => {
    expect(normalize('example.com/email/unsubscribe?u=123')).toEqual({ ok: false, reason: 'sensitive-path' });
  });
});
