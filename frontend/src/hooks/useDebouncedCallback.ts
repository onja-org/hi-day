"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Defers `callback` until `delayMs` after the last call. For a control
 * that fires per keystroke — a number input's steppers especially — where
 * saving each one would be a request per click.
 *
 * The latest callback is kept in a ref, so a caller doesn't have to
 * memoise it to avoid resetting the timer on every render.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  const latest = useRef(callback);
  const handle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Assigned in an effect, not during render: a ref written while
  // rendering is one React is free to discard.
  useEffect(() => {
    latest.current = callback;
  }, [callback]);

  useEffect(
    () => () => {
      if (handle.current) clearTimeout(handle.current);
    },
    [],
  );

  return useCallback(
    (...args: Args) => {
      if (handle.current) clearTimeout(handle.current);
      handle.current = setTimeout(() => latest.current(...args), delayMs);
    },
    [delayMs],
  );
}
