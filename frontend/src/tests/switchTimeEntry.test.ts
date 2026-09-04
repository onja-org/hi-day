import { afterEach, describe, expect, it, vi } from "vitest";
import { switchTimeEntry } from "@/lib/switchTimeEntry";

describe("switchTimeEntry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops the running entry and starts the new one", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "te-2", projectId: "p-2" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await switchTimeEntry("org-1", "p-2", "task-2");

    expect(result).toEqual({ ok: true, entry: { id: "te-2", projectId: "p-2" } });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/time-entries/switch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ projectId: "p-2", taskId: "task-2" }),
      }),
    );
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await switchTimeEntry("org-1", "p-2", null);

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
