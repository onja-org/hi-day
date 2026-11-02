import { describe, expect, it } from 'vitest';
import {
  defaultApiBaseUrl,
  normaliseServerUrl,
  resolveApiBaseUrl,
  validateServerUrl,
} from '../api-base-url';

describe('resolveApiBaseUrl', () => {
  it('defaults an unpackaged (dev) app to localhost', () => {
    expect(resolveApiBaseUrl(false, null, {})).toBe('http://localhost:3001');
  });

  it('defaults a packaged (installed) app to the production API', () => {
    expect(resolveApiBaseUrl(true, null, {})).toBe('https://api.hiday.io');
  });

  it('lets DESKTOP_API_URL override the packaged default', () => {
    expect(
      resolveApiBaseUrl(true, null, {
        DESKTOP_API_URL: 'https://staging.example.test',
      }),
    ).toBe('https://staging.example.test');
  });

  it('lets DESKTOP_API_URL override the dev default too', () => {
    expect(
      resolveApiBaseUrl(false, null, {
        DESKTOP_API_URL: 'https://staging.example.test',
      }),
    ).toBe('https://staging.example.test');
  });

  /**
   * Hi Day is self-hostable, so most installs are not talking to hiday.io
   * and must be able to say so without a custom build.
   */
  it('uses the server this install remembered', () => {
    expect(
      resolveApiBaseUrl(true, 'https://hiday.acme.example', {}),
    ).toBe('https://hiday.acme.example');
  });

  // The env var stays the escape hatch for CI and staging.
  it('still lets DESKTOP_API_URL beat a remembered server', () => {
    expect(
      resolveApiBaseUrl(true, 'https://hiday.acme.example', {
        DESKTOP_API_URL: 'https://staging.example.test',
      }),
    ).toBe('https://staging.example.test');
  });

  it('falls back to the default once a remembered server is cleared', () => {
    expect(resolveApiBaseUrl(true, null, {})).toBe(defaultApiBaseUrl(true));
  });
});

/**
 * A device token travels on every request. Over plain HTTP on a hostile
 * network it is readable, so the scheme is the one thing checked strictly.
 */
describe('validateServerUrl', () => {
  it('accepts an https server', () => {
    expect(validateServerUrl('https://hiday.acme.example')).toBeNull();
  });

  it('accepts a port and a path prefix', () => {
    expect(validateServerUrl('https://acme.example:8443/hiday')).toBeNull();
  });

  it('asks for something when the field is empty', () => {
    expect(validateServerUrl('')).toMatch(/enter the address/i);
    expect(validateServerUrl('   ')).toMatch(/enter the address/i);
  });

  it('rejects something that is not a URL at all', () => {
    expect(validateServerUrl('hiday.acme.example')).toMatch(/not a valid/i);
    expect(validateServerUrl('http://')).toMatch(/not a valid/i);
  });

  it('rejects a scheme that is not http or https', () => {
    expect(validateServerUrl('ftp://acme.example')).toMatch(/https:\/\//);
    expect(validateServerUrl('file:///etc/passwd')).toMatch(/https:\/\//);
  });

  // The traffic never leaves the machine.
  it('allows plain http for localhost', () => {
    expect(validateServerUrl('http://localhost:3001')).toBeNull();
    expect(validateServerUrl('http://127.0.0.1:3001')).toBeNull();
  });

  /**
   * A self-hosted Hi Day on an office LAN very often has no certificate.
   * Refusing it would make the product unusable for the people it is for.
   */
  it('allows plain http on a private network', () => {
    for (const host of [
      'http://192.168.1.50:3001',
      'http://10.0.0.8',
      'http://172.16.4.1',
      'http://172.31.255.254',
      'http://hiday.local',
    ]) {
      expect(validateServerUrl(host)).toBeNull();
    }
  });

  it('refuses plain http to a public host', () => {
    expect(validateServerUrl('http://hiday.acme.example')).toMatch(
      /use https/i,
    );
    // 172.32 is outside the private 172.16/12 block.
    expect(validateServerUrl('http://172.32.0.1')).toMatch(/use https/i);
    expect(validateServerUrl('http://8.8.8.8')).toMatch(/use https/i);
  });

  it('is not fooled by an uppercase host', () => {
    expect(validateServerUrl('http://LOCALHOST:3001')).toBeNull();
    expect(validateServerUrl('http://HIDAY.ACME.EXAMPLE')).toMatch(/use https/i);
  });
});

/**
 * Every request is built as `${base}/path`, so a stored trailing slash
 * would produce a double slash. Normalising once means no caller has to
 * remember, and two people who typed the same server with and without the
 * slash end up on the same string.
 */
describe('normaliseServerUrl', () => {
  it('drops a trailing slash', () => {
    expect(normaliseServerUrl('https://hiday.acme.example/')).toBe(
      'https://hiday.acme.example',
    );
  });

  it('drops several', () => {
    expect(normaliseServerUrl('https://hiday.acme.example///')).toBe(
      'https://hiday.acme.example',
    );
  });

  it('keeps a path prefix, without its trailing slash', () => {
    expect(normaliseServerUrl('https://acme.example/hiday/')).toBe(
      'https://acme.example/hiday',
    );
  });

  it('keeps a non-default port', () => {
    expect(normaliseServerUrl('https://acme.example:8443')).toBe(
      'https://acme.example:8443',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(normaliseServerUrl('  https://acme.example  ')).toBe(
      'https://acme.example',
    );
  });

  it('gives the same answer however it was typed', () => {
    expect(normaliseServerUrl('https://acme.example/')).toBe(
      normaliseServerUrl('https://acme.example'),
    );
  });
});
