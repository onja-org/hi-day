import { describe, expect, it, vi } from 'vitest';
import type { ScreenCastOutcome } from '../screencast-portal';
import { WaylandSilentCapture } from '../wayland-silent-capture';

function make(
  outcome: ScreenCastOutcome,
  options: { token?: string | null; available?: boolean } = {},
) {
  let token = options.token === undefined ? 'old-token' : options.token;
  const screenCast = vi.fn().mockResolvedValue(outcome);
  const subject = new WaylandSilentCapture({
    loadToken: () => token,
    saveToken: (t) => {
      token = t;
    },
    screenCast,
    isAvailable: () => Promise.resolve(options.available ?? true),
  });
  return { subject, screenCast, token: () => token };
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

    it('drops a rejected token so the picker never shows on a tick again', async () => {
      const { subject, token } = make({ kind: 'token-rejected' });

      expect(await subject.capture()).toBeNull();
      expect(token()).toBeNull();
      expect(subject.hasGrant()).toBe(false);
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
