import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HALF_HOUR_MS, useNow } from "@/hooks/useNow";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T13:21:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports the current time once subscribed", () => {
    const { result } = renderHook(() => useNow(HALF_HOUR_MS));

    expect(result.current).toEqual(new Date("2026-01-05T13:21:00.000Z"));
  });

  it("does not move before the interval elapses", () => {
    const { result } = renderHook(() => useNow(HALF_HOUR_MS));

    act(() => {
      vi.advanceTimersByTime(HALF_HOUR_MS - 1);
    });

    expect(result.current).toEqual(new Date("2026-01-05T13:21:00.000Z"));
  });

  it("moves forward once each interval elapses", () => {
    const { result } = renderHook(() => useNow(HALF_HOUR_MS));

    act(() => {
      vi.advanceTimersByTime(HALF_HOUR_MS);
    });
    expect(result.current).toEqual(new Date("2026-01-05T13:51:00.000Z"));

    act(() => {
      vi.advanceTimersByTime(HALF_HOUR_MS);
    });
    expect(result.current).toEqual(new Date("2026-01-05T14:21:00.000Z"));
  });

  // The clock is shared per interval, so the last subscriber leaving has to
  // stop it — otherwise an interval ticks on for the life of the tab.
  it("stops its interval once the last subscriber unmounts", () => {
    const clearInterval = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = renderHook(() => useNow(HALF_HOUR_MS));

    unmount();

    expect(clearInterval).toHaveBeenCalled();
    clearInterval.mockRestore();
  });

  it("re-reads the clock when a subscriber arrives long after load", () => {
    const { unmount } = renderHook(() => useNow(HALF_HOUR_MS));
    unmount();

    vi.setSystemTime(new Date("2026-01-05T18:00:00.000Z"));
    const { result } = renderHook(() => useNow(HALF_HOUR_MS));

    expect(result.current).toEqual(new Date("2026-01-05T18:00:00.000Z"));
  });

  it("is half an hour", () => {
    expect(HALF_HOUR_MS).toBe(1_800_000);
  });
});
