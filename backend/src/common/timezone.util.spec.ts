import { isValidTimezone } from './timezone.util';

describe('isValidTimezone', () => {
  it('accepts an Area/Location zone', () => {
    expect(isValidTimezone('Indian/Antananarivo')).toBe(true);
    expect(isValidTimezone('Africa/Nairobi')).toBe(true);
  });

  it('accepts UTC, the Organisation default', () => {
    expect(isValidTimezone('UTC')).toBe(true);
  });

  // The value arrives from a browser, so it is not to be trusted.
  it('rejects a zone the runtime does not know', () => {
    expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });

  // Intl accepts these, but they carry no region or city, so they cannot be
  // labelled the way the selector needs.
  it('rejects legacy abbreviations and POSIX forms Intl would otherwise allow', () => {
    expect(isValidTimezone('EAT')).toBe(false);
    expect(isValidTimezone('est5edt')).toBe(false);
  });
});
