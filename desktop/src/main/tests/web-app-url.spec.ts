import { describe, expect, it } from 'vitest';
import { resolveWebAppUrl } from '../web-app-url';

describe('where the tray sends you for the dashboard', () => {
  const PAIRED = 'https://work.example.com';

  it('uses what the server told us when pairing', () => {
    // The deployment's own answer, so it follows whichever backend this
    // install talks to.
    expect(resolveWebAppUrl(true, PAIRED)).toBe(PAIRED);
    expect(resolveWebAppUrl(false, PAIRED)).toBe(PAIRED);
  });

  it('still works in dev before this install has ever paired', () => {
    // The bug this closes: the item was hidden for everybody already
    // signed in, since pairing is the only thing that stores the origin
    // and it had long since happened.
    expect(resolveWebAppUrl(false, null)).toBe('http://localhost:3000');
  });

  it('offers nothing from a packaged build that has never paired', () => {
    // An installed app cannot inherit a developer's shell, and a wrong
    // link in the tray is worse than no link.
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
