import type { InputCountsUnavailableReason, InputHook } from './input-counter';

/** The slice of `uiohook-napi` used here — required lazily, so a build or
 * machine without it degrades to "not available" instead of crashing. */
interface UiohookModule {
  uIOhook: {
    on(event: 'keydown' | 'keyup', listener: (e: { keycode: number }) => void): void;
    on(event: 'mousedown', listener: () => void): void;
    on(event: 'mousemove', listener: (e: { x: number; y: number }) => void): void;
    start(): void;
    stop(): void;
  };
}

/**
 * The global keyboard/mouse hook, or null when the native module can't be
 * loaded. Only ever handed key codes (to tell a held key from a new press)
 * and pointer positions (to measure travel); the counter keeps neither.
 */
export function loadUiohook(log: (line: string) => void): InputHook | null {
  let module: UiohookModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    module = require('uiohook-napi') as UiohookModule;
  } catch (error) {
    log(`[input-hook] uiohook-napi unavailable, input counts disabled: ${String(error)}`);
    return null;
  }
  const hook = module.uIOhook;
  return {
    onKeyDown: (listener) => hook.on('keydown', (e) => listener(e.keycode)),
    onKeyUp: (listener) => hook.on('keyup', (e) => listener(e.keycode)),
    onMouseDown: (listener) => hook.on('mousedown', () => listener()),
    // uiohook reports drags as moves too, so travel while dragging counts.
    onMouseMove: (listener) => hook.on('mousemove', (e) => listener(e.x, e.y)),
    start: () => hook.start(),
    stop: () => hook.stop(),
  };
}

export interface InputHookEnvironment {
  platform: NodeJS.Platform;
  isWayland: boolean;
  /** macOS only: whether this app may monitor input (Accessibility). Must
   * not prompt — asking is the renderer's "Grant Access" button's job. */
  macInputTrusted: () => boolean;
}

/**
 * Why a global input hook can't count on this machine right now, or null
 * when it can. Antivirus can't be known in advance; a refused start is
 * caught when the hook starts instead.
 */
export function inputHookBlocker(
  environment: InputHookEnvironment,
): InputCountsUnavailableReason | null {
  if (environment.platform === 'linux' && environment.isWayland) {
    return 'wayland';
  }
  if (environment.platform === 'darwin' && !environment.macInputTrusted()) {
    return 'permission';
  }
  return null;
}
