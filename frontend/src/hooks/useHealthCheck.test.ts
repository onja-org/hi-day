import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useHealthCheck } from "./useHealthCheck";

describe("useHealthCheck", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the backend health payload on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ status: "ok", message: "Backend is running" }),
      }),
    );

    const { result } = renderHook(() => useHealthCheck());

    await waitFor(() =>
      expect(result.current.health).toEqual({
        status: "ok",
        message: "Backend is running",
      }),
    );
    expect(result.current.error).toBeNull();
  });

  it("returns an error message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const { result } = renderHook(() => useHealthCheck());

    await waitFor(() =>
      expect(result.current.error).toBe("Could not reach the backend."),
    );
    expect(result.current.health).toBeNull();
  });

  it("returns an error message when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    const { result } = renderHook(() => useHealthCheck());

    await waitFor(() =>
      expect(result.current.error).toBe("Could not reach the backend."),
    );
    expect(result.current.health).toBeNull();
  });
});
