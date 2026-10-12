import { afterEach, describe, expect, it, vi } from "vitest";
import { createManualTimeEntry } from "@/lib/createManualTimeEntry";

describe("createManualTimeEntry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the ISO-converted start/end to the project's time-entries collection", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          entry: { id: "te-1", source: "manual" },
          message: "Time entry created",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createManualTimeEntry("org-1", {
      projectId: "p-1",
      taskId: "task-1",
      startedAt: "2026-01-01T09:00",
      endedAt: "2026-01-01T10:00",
    });

    expect(result).toEqual({
      ok: true,
      entry: { id: "te-1", source: "manual" },
      message: "Time entry created",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/time-entries",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          taskId: "task-1",
          startedAt: new Date("2026-01-01T09:00").toISOString(),
          endedAt: new Date("2026-01-01T10:00").toISOString(),
        }),
      }),
    );
  });

  it("includes membershipId when logging time on someone else's behalf", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          entry: { id: "te-1", source: "manual" },
          message: "Time entry created",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createManualTimeEntry("org-1", {
      projectId: "p-1",
      startedAt: "2026-01-01T09:00",
      endedAt: "2026-01-01T10:00",
      membershipId: "m-2",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/time-entries",
      expect.objectContaining({
        body: JSON.stringify({
          taskId: undefined,
          startedAt: new Date("2026-01-01T09:00").toISOString(),
          endedAt: new Date("2026-01-01T10:00").toISOString(),
          membershipId: "m-2",
        }),
      }),
    );
  });

  it("sends the reason, so the Manual time edits report's add rows aren't blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ entry: { id: "te-1" }, message: "Time entry created" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createManualTimeEntry("org-1", {
      projectId: "p-1",
      startedAt: "2026-01-01T09:00",
      endedAt: "2026-01-01T10:00",
      reason: "Forgot to start timer",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/time-entries",
      expect.objectContaining({
        body: JSON.stringify({
          taskId: undefined,
          startedAt: new Date("2026-01-01T09:00").toISOString(),
          endedAt: new Date("2026-01-01T10:00").toISOString(),
          membershipId: undefined,
          reason: "Forgot to start timer",
        }),
      }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "End time must be after the start time." }),
      }),
    );

    const result = await createManualTimeEntry("org-1", {
      projectId: "p-1",
      startedAt: "2026-01-01T10:00",
      endedAt: "2026-01-01T09:00",
    });

    expect(result).toEqual({
      ok: false,
      message: "End time must be after the start time.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await createManualTimeEntry("org-1", {
      projectId: "p-1",
      startedAt: "2026-01-01T09:00",
      endedAt: "2026-01-01T10:00",
    });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
