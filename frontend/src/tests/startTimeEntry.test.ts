import { afterEach, describe, expect, it, vi } from "vitest";
import { startTimeEntry } from "@/lib/startTimeEntry";

describe("startTimeEntry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the started entry on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "te-1", projectId: "p-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await startTimeEntry("org-1", "p-1", "task-1");

    expect(result).toEqual({ ok: true, entry: { id: "te-1", projectId: "p-1" } });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/organisations/org-1/projects/p-1/time-entries/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ taskId: "task-1" }),
      }),
    );
  });

  it("omits taskId from the body when none is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "te-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await startTimeEntry("org-1", "p-1", null);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({}) }),
    );
  });

  it("surfaces the running entry on a 409 conflict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "A timer is already running.",
            runningEntry: { id: "te-running" },
          }),
      }),
    );

    const result = await startTimeEntry("org-1", "p-1", null);

    expect(result).toEqual({
      ok: false,
      message: "A timer is already running.",
      runningEntry: { id: "te-running" },
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await startTimeEntry("org-1", "p-1", null);

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
