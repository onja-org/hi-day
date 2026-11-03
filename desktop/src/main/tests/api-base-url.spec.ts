import { describe, expect, it } from 'vitest';
import {
  defaultApiBaseUrl,
  normaliseServerUrl,
  resolveApiBaseUrl,
  validateServerUrl,
} from '../api-base-url';

describe('resolveApiBaseUrl', () => {
  it('defaults by whether the app is packaged', () => {
    expect(resolveApiBaseUrl(true, null, {})).toBe('https://api.hiday.io');
    expect(resolveApiBaseUrl(false, null, {})).toBe('http://localhost:3001');
  });

  /** Most installs are self-hosted and not talking to hiday.io. */
  it('uses the server this install remembered', () => {
    expect(resolveApiBaseUrl(true, 'https://hiday.acme.example', {})).toBe(
      'https://hiday.acme.example',
    );
  });

  it('lets DESKTOP_API_URL beat both', () => {
    const env = { DESKTOP_API_URL: 'https://staging.example.test' };

    expect(resolveApiBaseUrl(true, 'https://remembered.test', env)).toBe(
      'https://staging.example.test',
    );
    expect(resolveApiBaseUrl(false, null, env)).toBe(
      'https://staging.example.test',
    );
  });

  it('falls back to the default once a remembered server is cleared', () => {
    expect(resolveApiBaseUrl(true, null, {})).toBe(defaultApiBaseUrl(true));
  });
});

/** A device token travels on every request, so the scheme is the one thing
 * checked strictly. */
describe('validateServerUrl', () => {
  it('accepts https, with a port and path', () => {
    expect(validateServerUrl('https://acme.example:8443/hiday')).toBeNull();
  });

  it('rejects an empty field and anything that is not a URL', () => {
    expect(validateServerUrl('  ')).toMatch(/enter the address/i);
    expect(validateServerUrl('acme.example')).toMatch(/not a valid/i);
    expect(validateServerUrl('ftp://acme.example')).toMatch(/https:\/\//);
  });

  /** A self-hosted server on an office LAN rarely has a certificate, and
   * that traffic never leaves the network. */
  it('allows plain http only on localhost and private networks', () => {
    for (const ok of [
      'http://localhost:3001',
      'http://127.0.0.1',
      'http://192.168.1.50',
      'http://10.0.0.8',
      'http://172.16.4.1',
      'http://LOCALHOST:3001',
      'http://hiday.local',
    ]) {
      expect(validateServerUrl(ok)).toBeNull();
    }

    // 172.32 sits outside the private 172.16/12 block.
    for (const bad of [
      'http://hiday.acme.example',
      'http://172.32.0.1',
      'http://8.8.8.8',
    ]) {
      expect(validateServerUrl(bad)).toMatch(/use https/i);
    }
  });
});

/** Requests are built as `${base}/path`, so a stored slash would double up. */
describe('normaliseServerUrl', () => {
  it('trims whitespace and trailing slashes, keeping port and path', () => {
    expect(normaliseServerUrl('  https://acme.example///  ')).toBe(
      'https://acme.example',
    );
    expect(normaliseServerUrl('https://acme.example:8443/hiday/')).toBe(
      'https://acme.example:8443/hiday',
    );
    expect(normaliseServerUrl('https://acme.example/')).toBe(
      normaliseServerUrl('https://acme.example'),
    );
  });
});
