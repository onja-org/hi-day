import { describe, expect, it } from 'vitest';
import { resolveWebAppUrl } from '../web-app-url';

describe('where the tray sends you for the dashboard', () => {
  const PAIRED = 'https://work.example.com';

  it('uses what the server told us when pairing', () => {
    expect(resolveWebAppUrl(true, PAIRED)).toBe(PAIRED);
    expect(resolveWebAppUrl(false, PAIRED)).toBe(PAIRED);
  });

  // The bug this closes: pairing used to be the only thing that stored
  // the origin, so the item was hidden for everybody already signed in.
  // The capture-settings poll now supplies it too; this is the floor
  // under a dev build that has not polled yet.
  it('still works in dev before anything has supplied one', () => {
    expect(resolveWebAppUrl(false, null)).toBe('http://localhost:3000');
  });

  it('offers nothing from a packaged build that has never paired', () => {
    expect(resolveWebAppUrl(true, null)).toBeNull();
  });

  it('lets the environment override either', () => {
    const env = { DESKTOP_WEB_URL: 'https://staging.example.com' };

    expect(resolveWebAppUrl(true, PAIRED, env)).toBe(
      'https://staging.example.com',
    );
    expect(resolveWebAppUrl(false, null, env)).toBe(
      'https://staging.example.com',
    );
  });
});
