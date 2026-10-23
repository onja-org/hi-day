import { describe, expect, it } from 'vitest';
import { extractResolverErrorCode, ResolverHealthTracker } from '../resolver-health';

describe('extractResolverErrorCode', () => {
  it('extracts the leading [code] tag', () => {
    expect(extractResolverErrorCode('[uia-timeout] UIA read did not complete within the 250ms deadline.')).toBe(
      'uia-timeout',
    );
  });

  it('lowercases the extracted code', () => {
    expect(extractResolverErrorCode('[Elevated-Target] ...')).toBe('elevated-target');
  });

  it('falls back to "unknown" for a message with no tag', () => {
    expect(extractResolverErrorCode('Resolver is not running.')).toBe('unknown');
  });
});

describe('ResolverHealthTracker', () => {
  it('starts in the "starting" state with no history', () => {
    const tracker = new ResolverHealthTracker();

    expect(tracker.snapshot()).toEqual({
      state: 'starting',
      lastReadyAt: null,
      lastSuccessfulResolveAt: null,
      recentErrorCounts: {},
      caps: null,
      lastErrorDetail: null,
    });
  });

  it("keeps the side-car's capabilities and its account of what it is short of", () => {
    const tracker = new ResolverHealthTracker();
    tracker.onReady(1_000, ['focus']);
    tracker.onSideCarError('Website tracking on Wayland is supported only on GNOME.');

    expect(tracker.snapshot()).toMatchObject({
      caps: ['focus'],
      lastErrorDetail: 'Website tracking on Wayland is supported only on GNOME.',
    });

    tracker.onReady(2_000, ['focus', 'url']);
    expect(tracker.snapshot()).toMatchObject({ caps: ['focus', 'url'], lastErrorDetail: null });
  });

  it('tracks state transitions and timestamps', () => {
    const tracker = new ResolverHealthTracker();

    tracker.onReady(1000);
    tracker.onSuccessfulResolve(2000);

    expect(tracker.snapshot()).toMatchObject({ state: 'ready', lastReadyAt: 1000, lastSuccessfulResolveAt: 2000 });
  });

  it('counts recent error codes', () => {
    const tracker = new ResolverHealthTracker();

    tracker.onResolveFailure('[uia-timeout] ...');
    tracker.onResolveFailure('[uia-timeout] ...');
    tracker.onResolveFailure('[elevated-target] ...');

    expect(tracker.snapshot().recentErrorCounts).toEqual({ 'uia-timeout': 2, 'elevated-target': 1 });
  });

  it('only counts the most recent N errors, dropping older ones', () => {
    const tracker = new ResolverHealthTracker();

    for (let i = 0; i < 25; i += 1) {
      tracker.onResolveFailure('[old-error] ...');
    }
    tracker.onResolveFailure('[new-error] ...');

    const counts = tracker.snapshot().recentErrorCounts;
    expect(counts['new-error']).toBe(1);
    expect(counts['old-error']).toBe(19); // 20-window cap, one slot now taken by new-error
  });

  it('degraded and restarting states are reflected in the snapshot', () => {
    const tracker = new ResolverHealthTracker();
    tracker.onReady(1000);

    tracker.onRestarting();
    expect(tracker.snapshot().state).toBe('restarting');

    tracker.onDegraded();
    expect(tracker.snapshot().state).toBe('degraded');
  });
});
