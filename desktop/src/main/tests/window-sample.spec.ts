import { describe, expect, it } from 'vitest';
import { classifyTitleUnavailability } from '../window-sample';

describe('classifyTitleUnavailability', () => {
  it("returns 'permission-denied' on macOS when Accessibility isn't granted", () => {
    expect(
      classifyTitleUnavailability({
        platform: 'macos',
        macAccessibilityGranted: false,
        isWayland: false,
        rawTitle: 'Some Title',
        rawOwnerName: 'Some App',
      }),
    ).toBe('permission-denied');
  });

  it("takes priority over an otherwise-valid title on macOS when Accessibility isn't granted", () => {
    expect(
      classifyTitleUnavailability({
        platform: 'macos',
        macAccessibilityGranted: false,
        isWayland: false,
        rawTitle: undefined,
        rawOwnerName: undefined,
      }),
    ).toBe('permission-denied');
  });

  it("returns 'not-exposed' on a Linux Wayland session", () => {
    expect(
      classifyTitleUnavailability({
        platform: 'linux',
        macAccessibilityGranted: true,
        isWayland: true,
        rawTitle: undefined,
        rawOwnerName: undefined,
      }),
    ).toBe('not-exposed');
  });

  it("returns 'hidden-by-app' when an app name came back but no title", () => {
    expect(
      classifyTitleUnavailability({
        platform: 'linux',
        macAccessibilityGranted: true,
        isWayland: false,
        rawTitle: '',
        rawOwnerName: 'Signal',
      }),
    ).toBe('hidden-by-app');
  });

  it("returns 'hidden-by-app' when the title is whitespace-only", () => {
    expect(
      classifyTitleUnavailability({
        platform: 'windows',
        macAccessibilityGranted: true,
        isWayland: false,
        rawTitle: '   ',
        rawOwnerName: 'KeePass',
      }),
    ).toBe('hidden-by-app');
  });

  it('returns null when a usable title is present', () => {
    expect(
      classifyTitleUnavailability({
        platform: 'windows',
        macAccessibilityGranted: true,
        isWayland: false,
        rawTitle: 'Unicorns - Google Search',
        rawOwnerName: 'Google Chrome',
      }),
    ).toBeNull();
  });

  it('returns null when there is no owner at all (nothing to flag as hidden)', () => {
    expect(
      classifyTitleUnavailability({
        platform: 'linux',
        macAccessibilityGranted: true,
        isWayland: false,
        rawTitle: undefined,
        rawOwnerName: undefined,
      }),
    ).toBeNull();
  });
});
