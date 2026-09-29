import { afterEach, describe, expect, it, vi } from "vitest";
import { setTaskStage } from "@/lib/setTaskStage";

describe("setTaskStage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the new stage for the task", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ task: { id: "t-1", stage: "done" }, message: "Task moved" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await setTaskStage("org-1", "p-1", "t-1", "done");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/tasks/t-1/stage",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ stage: "done" }) }),
    );
    expect(result).toEqual({ ok: true, task: { id: "t-1", stage: "done" }, message: "Task moved" });
  });

  it("surfaces the backend's error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Only the assignee or a project admin can move this task." }),
      }),
    );
    expect(await setTaskStage("org-1", "p-1", "t-1", "done")).toEqual({
      ok: false,
      message: "Only the assignee or a project admin can move this task.",
    });
  });

  it("returns a generic error when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await setTaskStage("org-1", "p-1", "t-1", "todo")).ok).toBe(false);
  });
});
