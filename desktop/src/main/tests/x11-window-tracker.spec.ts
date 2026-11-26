import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { X11Display } from 'x11';
import { X11WindowTracker } from '../x11-window-tracker';

const NET_ACTIVE_WINDOW = 301;
const NET_WM_NAME = 302;
const WM_CLASS = 67;
const ROOT = 1;

type PropertyAnswer = { data: Buffer } | { error: Error & { error?: number } };

/**
 * Stands in for the `x11` package's client, including the one behaviour that
 * matters here: when the server answers a request with an error, the
 * library hands it to the request's callback and, unless that callback
 * returns `true`, also emits it as `'error'` on the client
 * (x11/lib/xcore.js). An `'error'` nobody listens for is thrown by Node —
 * from the socket's data handler, where nothing can catch it — and takes
 * the whole app down through `uncaughtException`. `crashes` records each
 * error that would have done that.
 */
class FakeX11Client extends EventEmitter {
  readonly crashes: Error[] = [];
  readonly callbackResults: unknown[] = [];

  constructor(private readonly answer: (window: number, atom: number) => PropertyAnswer) {
    super();
  }

  InternAtom(_onlyIfExists: boolean, name: string, cb: (err: Error | null, atom: number) => unknown): void {
    cb(null, name === '_NET_ACTIVE_WINDOW' ? NET_ACTIVE_WINDOW : NET_WM_NAME);
  }

  GetProperty(
    _del: number,
    window: number,
    atom: number,
    _type: number,
    _offset: number,
    _length: number,
    cb: (err: Error | null, prop?: { data?: Buffer }) => unknown,
  ): void {
    const answer = this.answer(window, atom);
    if ('data' in answer) {
      cb(null, { data: answer.data });
      return;
    }
    const handled = cb(answer.error);
    this.callbackResults.push(handled);
    if (!handled) this.emitAsTheLibraryDoes(answer.error);
  }

  /** What `client.emit('error', error)` does in the real library. */
  emitAsTheLibraryDoes(error: Error): void {
    if (this.listenerCount('error') === 0) {
      this.crashes.push(error);
      return;
    }
    this.emit('error', error);
  }
}

function badWindow(): Error & { error: number } {
  return Object.assign(new Error('Bad window'), { error: 3 });
}

function windowIdBuffer(id: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(id, 0);
  return buffer;
}

function trackerWith(client: FakeX11Client, logger = vi.fn()) {
  const display = { client, screen: [{ root: ROOT }], terminate: vi.fn() } as unknown as X11Display;
  const tracker = new X11WindowTracker({
    pollIntervalMs: 60_000,
    logger,
    createClient: (cb) => cb(null, display),
  });
  return { tracker, logger, display };
}

describe('X11WindowTracker', () => {
  it('reads the focused window title and application class', async () => {
    const client = new FakeX11Client((window, atom) => {
      if (window === ROOT && atom === NET_ACTIVE_WINDOW) return { data: windowIdBuffer(42) };
      if (atom === NET_WM_NAME) return { data: Buffer.from('Inbox - Mail') };
      if (atom === WM_CLASS) return { data: Buffer.from('mail\0Thunderbird\0') };
      return { data: Buffer.alloc(0) };
    });
    const { tracker } = trackerWith(client);

    await tracker.start();

    expect(tracker.state).toBe('up');
    expect(tracker.getLastFocus()).toEqual({ appName: 'Thunderbird', title: 'Inbox - Mail' });
    tracker.stop();
  });

  // The reported bug: on Ubuntu 20.04 / X11, closing the Screenshot app's
  // window between reading _NET_ACTIVE_WINDOW and reading the window's
  // properties made the server answer BadWindow, which crashed Hi Day and
  // stopped the timer.
  it('does not crash when the focused window is destroyed mid-read (BadWindow)', async () => {
    const client = new FakeX11Client((window, atom) => {
      if (window === ROOT && atom === NET_ACTIVE_WINDOW) return { data: windowIdBuffer(42) };
      return { error: badWindow() };
    });
    const { tracker } = trackerWith(client);

    await tracker.start();

    expect(client.crashes).toEqual([]);
    expect(client.callbackResults.length).toBeGreaterThan(0);
    expect(client.callbackResults.every((handled) => handled === true)).toBe(true);
    expect(tracker.getLastFocus()).toBeNull();
    expect(tracker.state).toBe('up');
    tracker.stop();
  });

  it('logs an X error that arrives with no request waiting for it, instead of crashing', async () => {
    const client = new FakeX11Client(() => ({ data: Buffer.alloc(0) }));
    const { tracker, logger } = trackerWith(client);
    await tracker.start();

    client.emitAsTheLibraryDoes(badWindow());

    expect(client.crashes).toEqual([]);
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('Bad window'));
    expect(tracker.state).toBe('up');
    tracker.stop();
  });

  it('marks itself down and stops polling when the X connection itself fails', async () => {
    const client = new FakeX11Client(() => ({ data: Buffer.alloc(0) }));
    const { tracker, logger, display } = trackerWith(client);
    await tracker.start();

    client.emitAsTheLibraryDoes(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }));

    expect(client.crashes).toEqual([]);
    expect(tracker.state).toBe('down');
    expect(tracker.getLastFocus()).toBeNull();
    expect(display.terminate).toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('ECONNRESET'));
  });

  it('stays down quietly when there is no X display', async () => {
    const logger = vi.fn();
    const tracker = new X11WindowTracker({
      logger,
      createClient: (cb) => cb(new Error('no display')),
    });

    await tracker.start();

    expect(tracker.state).toBe('down');
    expect(tracker.getLastFocus()).toBeNull();
  });
});
