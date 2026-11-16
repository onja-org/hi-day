import { describe, expect, it } from 'vitest';
import { InputCounter } from '../input-counter';
import type { InputCountsUnavailableReason, InputHook } from '../input-counter';

/** A hook the test drives by hand. */
function makeHook(startError?: Error) {
  const listeners = {
    keydown: [] as ((keycode: number) => void)[],
    keyup: [] as ((keycode: number) => void)[],
    mousedown: [] as (() => void)[],
    mousemove: [] as ((x: number, y: number) => void)[],
  };
  let starts = 0;
  let stops = 0;
  const hook: InputHook = {
    onKeyDown: (listener) => listeners.keydown.push(listener),
    onKeyUp: (listener) => listeners.keyup.push(listener),
    onMouseDown: (listener) => listeners.mousedown.push(listener),
    onMouseMove: (listener) => listeners.mousemove.push(listener),
    start: () => {
      if (startError) throw startError;
      starts += 1;
    },
    stop: () => {
      stops += 1;
    },
  };
  return {
    hook,
    keyDown: (code: number) => listeners.keydown.forEach((l) => l(code)),
    keyUp: (code: number) => listeners.keyup.forEach((l) => l(code)),
    press: (code: number) => {
      listeners.keydown.forEach((l) => l(code));
      listeners.keyup.forEach((l) => l(code));
    },
    click: () => listeners.mousedown.forEach((l) => l()),
    move: (x: number, y: number) => listeners.mousemove.forEach((l) => l(x, y)),
    starts: () => starts,
    stops: () => stops,
  };
}

function makeCounter(
  options: {
    hook?: InputHook | null;
    blocker?: () => InputCountsUnavailableReason | null;
  } = {},
) {
  return new InputCounter({
    blocker: options.blocker ?? (() => null),
    loadHook: () => (options.hook === undefined ? makeHook().hook : options.hook),
  });
}

describe('InputCounter', () => {
  it('counts key presses, clicks and pointer travel for the period', () => {
    const input = makeHook();
    const counter = makeCounter({ hook: input.hook });

    counter.start();
    input.press(30);
    input.press(31);
    input.click();
    input.move(0, 0);
    input.move(3, 4); // 5 px
    input.move(3, 14); // 10 px

    expect(counter.take()).toEqual({
      keystrokes: 2,
      mouseClicks: 1,
      mouseMovement: 15,
    });
  });

  it('counts a held, auto-repeating key once', () => {
    const input = makeHook();
    const counter = makeCounter({ hook: input.hook });

    counter.start();
    input.keyDown(30);
    input.keyDown(30);
    input.keyDown(30);
    input.keyUp(30);
    input.press(30);

    expect(counter.take()?.keystrokes).toBe(2);
  });

  it('starts each period from zero', () => {
    const input = makeHook();
    const counter = makeCounter({ hook: input.hook });

    counter.start();
    input.press(1);
    counter.take();
    input.click();

    expect(counter.take()).toEqual({
      keystrokes: 0,
      mouseClicks: 1,
      mouseMovement: 0,
    });
  });

  it('reports a real zero when counting ran and nothing happened', () => {
    const counter = makeCounter();

    counter.start();

    expect(counter.take()).toEqual({
      keystrokes: 0,
      mouseClicks: 0,
      mouseMovement: 0,
    });
  });

  it('counts nothing after stop', () => {
    const input = makeHook();
    const counter = makeCounter({ hook: input.hook });

    counter.start();
    counter.stop();
    input.press(1);

    expect(input.stops()).toBe(1);
    expect(counter.take()).toBeNull();
  });

  it('is not available on Wayland, and never starts the hook there', () => {
    const input = makeHook();
    const counter = makeCounter({ hook: input.hook, blocker: () => 'wayland' });

    counter.start();

    expect(counter.take()).toBeNull();
    expect(counter.unavailableReason).toBe('wayland');
    expect(input.starts()).toBe(0);
  });

  it('is not available when the hook is refused, e.g. by antivirus', () => {
    const counter = makeCounter({
      hook: makeHook(new Error('access denied')).hook,
    });

    counter.start();

    expect(counter.take()).toBeNull();
    expect(counter.unavailableReason).toBe('blocked');
  });

  it('is not available when the native module is missing', () => {
    const counter = makeCounter({ hook: null });

    counter.start();

    expect(counter.take()).toBeNull();
    expect(counter.unavailableReason).toBe('missing');
  });

  // macOS: granting Accessibility mid-session. The period that was running
  // when it was granted wasn't counted throughout, so it stays unavailable;
  // the next one counts.
  it('starts counting from the next whole period once a permission is granted', () => {
    const input = makeHook();
    let trusted = false;
    const counter = makeCounter({
      hook: input.hook,
      blocker: () => (trusted ? null : 'permission'),
    });

    counter.start();
    trusted = true;
    expect(counter.take()).toBeNull();

    input.press(1);
    expect(counter.take()).toEqual({
      keystrokes: 1,
      mouseClicks: 0,
      mouseMovement: 0,
    });
    expect(counter.unavailableReason).toBeNull();
  });

  // A revoked permission makes the hook go quiet rather than fail, which
  // would otherwise read as a real zero.
  it('reports not available, not zero, once a permission is revoked', () => {
    const input = makeHook();
    let trusted = true;
    const counter = makeCounter({
      hook: input.hook,
      blocker: () => (trusted ? null : 'permission'),
    });

    counter.start();
    trusted = false;

    expect(counter.take()).toBeNull();
    expect(counter.unavailableReason).toBe('permission');
    expect(input.stops()).toBe(1);
  });
});
