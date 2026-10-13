import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

describe("useDebouncedCallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires once, with the last arguments, after a run of calls", () => {
    const save = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(save, 500));

    act(() => {
      result.current(1);
      result.current(2);
      result.current(3);
    });
    expect(save).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(500));

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(3);
  });

  it("does not fire after unmount", () => {
    const save = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDebouncedCallback(save, 500),
    );

    act(() => result.current(1));
    unmount();
    act(() => void vi.advanceTimersByTime(500));

    expect(save).not.toHaveBeenCalled();
  });
});
