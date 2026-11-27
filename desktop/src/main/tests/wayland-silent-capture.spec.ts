import { describe, expect, it, vi } from 'vitest';
import type { ScreenCastOutcome } from '../screencast-portal';
import { WaylandSilentCapture } from '../wayland-silent-capture';

function make(
  outcome: ScreenCastOutcome,
  options: { token?: string | null; available?: boolean } = {},
) {
  const setup = { current: 'laptop' };
  const tokens = new Map<string, string>();
  const initial = options.token === undefined ? 'old-token' : options.token;
  if (initial) tokens.set('laptop', initial);
  const screenCast = vi.fn().mockResolvedValue(outcome);
  const subject = new WaylandSilentCapture({
    loadToken: (key) => tokens.get(key) ?? null,
    saveToken: (key, t) => {
      if (t) tokens.set(key, t);
      else tokens.delete(key);
    },
    currentSetup: () => Promise.resolve(setup.current),
    screenCast,
    isAvailable: () => Promise.resolve(options.available ?? true),
  });
  return {
    subject,
    screenCast,
    token: () => tokens.get(setup.current) ?? null,
    tokenFor: (key: string) => tokens.get(key) ?? null,
    switchSetup: (key: string) => {
      setup.current = key;
    },
  };
}

const frame = Buffer.from('jpeg');

describe('WaylandSilentCapture', () => {
  describe('canBeGranted', () => {
    it('is false where the silent path is impossible, so a noisy grant keeps standing', async () => {
      const { subject } = make({ kind: 'unavailable' }, { available: false });

      expect(await subject.canBeGranted()).toBe(false);
    });

    it('is true where it could be asked for, even with no grant yet', async () => {
      const { subject } = make({ kind: 'unavailable' }, { token: null });

      expect(await subject.canBeGranted()).toBe(true);
    });
  });

  describe('capture (periodic tick)', () => {
    it('does nothing without a remembered grant — never shows the picker', async () => {
      const { subject, screenCast } = make(
        { kind: 'captured', buffer: frame, restoreToken: 'new' },
        { token: null },
      );

      expect(await subject.capture()).toBeNull();
      expect(screenCast).not.toHaveBeenCalled();
    });

    it('does nothing when frames cannot be grabbed (GStreamer missing)', async () => {
      const { subject, screenCast } = make(
        { kind: 'captured', buffer: frame, restoreToken: 'new' },
        { available: false },
      );

      expect(await subject.capture()).toBeNull();
      expect(screenCast).not.toHaveBeenCalled();
    });

    it('reuses the token and stores the fresh single-use one in its place', async () => {
      const { subject, screenCast, token } = make({
        kind: 'captured',
        buffer: frame,
        restoreToken: 'new',
      });

      expect(await subject.capture()).toBe(frame);
      expect(screenCast).toHaveBeenCalledWith('old-token');
      expect(token()).toBe('new');
    });

    it('keeps the token after one rejection, which a portal just woken or crashed gives', async () => {
      // After the lid opens, GNOME shows the picker instead of restoring the
      // choice — and has been seen to crash doing it. The choice itself is
      // still good; dropping it sent the person back to "Grant Access".
      const { subject, token } = make({ kind: 'token-rejected' });

      expect(await subject.capture()).toBeNull();
      expect(token()).toBe('old-token');
      expect(await subject.hasGrant()).toBe(true);
    });

    it('drops the token after three rejections in a row, so the picker stops showing on ticks', async () => {
      const { subject, token } = make({ kind: 'token-rejected' });

      await subject.capture();
      await subject.capture();
      expect(token()).toBe('old-token');
      await subject.capture();

      expect(token()).toBeNull();
      expect(await subject.hasGrant()).toBe(false);
    });

    it('starts counting again after a capture that works', async () => {
      const screenCast = vi
        .fn()
        .mockResolvedValueOnce({ kind: 'token-rejected' })
        .mockResolvedValueOnce({ kind: 'token-rejected' })
        .mockResolvedValueOnce({ kind: 'captured', buffer: frame, restoreToken: 'old-token' })
        .mockResolvedValue({ kind: 'token-rejected' });
      let token: string | null = 'old-token';
      const subject = new WaylandSilentCapture({
        loadToken: () => token,
        saveToken: (_setup, t) => {
          token = t;
        },
        screenCast,
        isAvailable: () => Promise.resolve(true),
      });

      for (let i = 0; i < 5; i += 1) await subject.capture();

      expect(token).toBe('old-token');
    });

    it('starts counting again after a new grant', async () => {
      const screenCast = vi
        .fn()
        .mockResolvedValueOnce({ kind: 'token-rejected' })
        .mockResolvedValueOnce({ kind: 'token-rejected' })
        .mockResolvedValueOnce({ kind: 'captured', buffer: frame, restoreToken: 'granted' })
        .mockResolvedValue({ kind: 'token-rejected' });
      let token: string | null = 'old-token';
      const subject = new WaylandSilentCapture({
        loadToken: () => token,
        saveToken: (_setup, t) => {
          token = t;
        },
        screenCast,
        isAvailable: () => Promise.resolve(true),
      });

      await subject.capture();
      await subject.capture();
      await subject.grant();
      await subject.capture();

      expect(token).toBe('granted');
    });

    it('keeps the old token when the session never started', async () => {
      const { subject, token } = make({ kind: 'failed' });

      await subject.capture();

      expect(token()).toBe('old-token');
    });

    it('keeps the rotated token when the session started but the frame grab failed', async () => {
      const { subject, token } = make({ kind: 'failed', restoreToken: 'rotated' });

      await subject.capture();

      expect(token()).toBe('rotated');
    });
  });

  describe('one remembered choice per screen setup', () => {
    // GNOME remembers a choice as one particular screen. Tried while that
    // screen is gone — the lid closed on a monitor — it shows the picker
    // and then forgets the choice for good, even once the lid opens again.
    it('does not try the choice made for another setup, so no picker shows and GNOME keeps it', async () => {
      const { subject, screenCast, tokenFor, switchSetup } = make({
        kind: 'captured',
        buffer: frame,
        restoreToken: 'old-token',
      });
      switchSetup('monitor-only');

      expect(await subject.capture()).toBeNull();

      expect(screenCast).not.toHaveBeenCalled();
      expect(tokenFor('laptop')).toBe('old-token');
    });

    it('has no grant for a setup never granted, so "Grant Access" is offered for it', async () => {
      const { subject, switchSetup } = make({ kind: 'unavailable' });
      expect(await subject.hasGrant()).toBe(true);

      switchSetup('monitor-only');

      expect(await subject.hasGrant()).toBe(false);
    });

    it('remembers a grant for the setup it was given in, leaving the others alone', async () => {
      const { subject, tokenFor, switchSetup } = make({
        kind: 'captured',
        buffer: frame,
        restoreToken: 'monitor-token',
      });
      switchSetup('monitor-only');

      await subject.grant();

      expect(tokenFor('monitor-only')).toBe('monitor-token');
      expect(tokenFor('laptop')).toBe('old-token');
    });

    it('uses the choice of each setup when back in it', async () => {
      const { subject, screenCast, switchSetup } = make({
        kind: 'captured',
        buffer: frame,
        restoreToken: 'monitor-token',
      });
      switchSetup('monitor-only');
      await subject.grant();

      switchSetup('laptop');
      screenCast.mockResolvedValue({ kind: 'captured', buffer: frame, restoreToken: 'old-token' });
      await subject.capture();

      expect(screenCast).toHaveBeenLastCalledWith('old-token');
    });

    it('counts rejections per setup', async () => {
      const { subject, tokenFor, switchSetup, screenCast } = make({ kind: 'token-rejected' });
      await subject.capture();
      await subject.capture();

      switchSetup('monitor-only');
      screenCast.mockResolvedValueOnce({ kind: 'captured', buffer: frame, restoreToken: 'm' });
      await subject.grant();
      await subject.capture();

      switchSetup('laptop');
      expect(tokenFor('laptop')).toBe('old-token');
      await subject.capture();
      expect(tokenFor('laptop')).toBeNull();
    });
  });

  describe('grant (Grant Access click)', () => {
    it('shows the picker and remembers the choice', async () => {
      const { subject, screenCast, token } = make(
        { kind: 'captured', buffer: frame, restoreToken: 'new' },
        { token: null },
      );

      expect(await subject.grant()).toEqual({ kind: 'granted', buffer: frame });
      expect(screenCast).toHaveBeenCalledWith(null);
      expect(token()).toBe('new');
    });

    it('reports a dismissed picker as cancelled', async () => {
      const { subject } = make({ kind: 'cancelled' }, { token: null });

      expect(await subject.grant()).toEqual({ kind: 'cancelled' });
    });

    it('is unavailable when the choice was not remembered', async () => {
      const { subject, token } = make(
        { kind: 'captured', buffer: frame, restoreToken: null },
        { token: null },
      );

      expect(await subject.grant()).toEqual({ kind: 'unavailable' });
      expect(token()).toBeNull();
    });

    it('is unavailable without the portal or GStreamer, never opening a picker for nothing', async () => {
      const { subject, screenCast } = make(
        { kind: 'captured', buffer: frame, restoreToken: 'new' },
        { token: null, available: false },
      );

      expect(await subject.grant()).toEqual({ kind: 'unavailable' });
      expect(screenCast).not.toHaveBeenCalled();
      expect((await make({ kind: 'unavailable' }, { token: null }).subject.grant()).kind).toBe(
        'unavailable',
      );
    });
  });
});
