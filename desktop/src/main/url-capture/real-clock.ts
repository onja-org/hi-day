import type { EngineClock } from './session-types';

/**
 * The one place allowed to touch real time directly for url-capture —
 * everything downstream of this (SessionEngine) receives time only via
 * event payloads, never by reaching for a clock itself.
 */
export function realClock(): EngineClock {
  return {
    monotonicMs: performance.now(),
    wallClockMs: Date.now(),
    tzOffsetMin: new Date().getTimezoneOffset(),
  };
}
