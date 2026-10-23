import { describe, expect, it } from 'vitest';
import { assessUrlCapture } from '../url-capture-health';
import type { ResolverHealthSnapshot } from '../url-capture/resolver-health';

function resolver(overrides: Partial<ResolverHealthSnapshot> = {}): ResolverHealthSnapshot {
  return {
    state: 'ready',
    lastReadyAt: 1,
    lastSuccessfulResolveAt: null,
    recentErrorCounts: {},
    caps: ['focus', 'url'],
    lastErrorDetail: null,
    ...overrides,
  };
}

describe('assessUrlCapture', () => {
  it('says nothing while URL capture is off or its reader is still starting', () => {
    expect(assessUrlCapture({ resolver: null, blindBrowsers: [] })).toBeNull();
    expect(
      assessUrlCapture({ resolver: resolver({ state: 'starting', caps: null }), blindBrowsers: [] }),
    ).toBeNull();
  });

  it('is ok when the reader has the url capability and no browser is blind', () => {
    expect(assessUrlCapture({ resolver: resolver(), blindBrowsers: [] })).toEqual({
      status: 'ok',
      detail: null,
    });
  });

  it("is unavailable without the url capability, in the side-car's own words", () => {
    const health = assessUrlCapture({
      resolver: resolver({
        caps: ['focus'],
        lastErrorDetail: 'Website tracking on Wayland is supported only on GNOME.',
      }),
      blindBrowsers: [],
    });
    expect(health).toEqual({
      status: 'unavailable',
      detail: 'Website tracking on Wayland is supported only on GNOME.',
    });
  });

  it('is unavailable once the reader has been given up on', () => {
    expect(
      assessUrlCapture({ resolver: resolver({ state: 'degraded' }), blindBrowsers: [] })?.status,
    ).toBe('unavailable');
  });

  it('is degraded while a browser runs blind, naming it', () => {
    const health = assessUrlCapture({ resolver: resolver(), blindBrowsers: ['Chrome'] });
    expect(health?.status).toBe('degraded');
    expect(health?.detail).toMatch(/^Chrome is running without website tracking/);
  });

  it('names every blind browser', () => {
    const health = assessUrlCapture({
      resolver: resolver(),
      blindBrowsers: ['Chrome', 'Brave', 'Firefox'],
    });
    expect(health?.detail).toMatch(/^Chrome, Brave and Firefox are running/);
  });
});
