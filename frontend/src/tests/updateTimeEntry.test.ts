import { afterEach, describe, expect, it, vi } from "vitest";
import { updateTimeEntry } from "@/lib/updateTimeEntry";

describe("updateTimeEntry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("only sends fields that were actually provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "te-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateTimeEntry("org-1", "te-1", { endedAt: "2026-01-01T11:00" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/time-entries/te-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          endedAt: new Date("2026-01-01T11:00").toISOString(),
        }),
      }),
    );
  });

  it("sends an explicit null taskId to clear it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "te-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateTimeEntry("org-1", "te-1", { taskId: null });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ taskId: null }) }),
    );
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await updateTimeEntry("org-1", "te-1", {
      endedAt: "2026-01-01T11:00",
    });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });

  it("asks to merge when told to", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "te-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateTimeEntry("org-1", "te-1", { projectId: "p-1", merge: true });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ projectId: "p-1", merge: true }),
      }),
    );
  });

  it("passes on the entries an overlap ran into", async () => {
    const overlaps = [
      {
        id: "te-2",
        projectName: "Website",
        startedAt: "2026-01-01T10:00:00.000Z",
        endedAt: "2026-01-01T11:00:00.000Z",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "These times overlap…", overlaps, canMerge: true }),
      }),
    );

    const result = await updateTimeEntry("org-1", "te-1", {
      endedAt: "2026-01-01T11:00",
    });

    expect(result).toEqual({
      ok: false,
      message: "These times overlap…",
      overlap: { overlaps, canMerge: true },
    });
  });
});
