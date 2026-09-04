import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from '../api-base-url';

describe('resolveApiBaseUrl', () => {
  it('defaults an unpackaged (dev) app to localhost', () => {
    expect(resolveApiBaseUrl(false, {})).toBe('http://localhost:3001');
  });

  it('defaults a packaged (installed) app to the production API', () => {
    expect(resolveApiBaseUrl(true, {})).toBe(
      'https://workfoce-monitoring-api.up.railway.app',
    );
  });

  it('lets DESKTOP_API_URL override the packaged default', () => {
    expect(
      resolveApiBaseUrl(true, { DESKTOP_API_URL: 'https://staging.example.test' }),
    ).toBe('https://staging.example.test');
  });

  it('lets DESKTOP_API_URL override the dev default too', () => {
    expect(
      resolveApiBaseUrl(false, { DESKTOP_API_URL: 'https://staging.example.test' }),
    ).toBe('https://staging.example.test');
  });
});
