import { afterEach, describe, expect, it, vi } from "vitest";
import { updateTask } from "@/lib/updateTask";

describe("updateTask", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the updated task on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "t-1", name: "Renamed" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateTask("org-1", "p-1", "t-1", { name: "Renamed" });

    expect(result).toEqual({ ok: true, task: { id: "t-1", name: "Renamed" } });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/organisations/org-1/projects/p-1/tasks/t-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed" }),
      }),
    );
  });

  it("supports explicitly clearing the assignee", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "t-1", assignee: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await updateTask("org-1", "p-1", "t-1", { assigneeProjectMembershipId: null });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: JSON.stringify({ assigneeProjectMembershipId: null }),
      }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Task not found." }),
      }),
    );

    const result = await updateTask("org-1", "p-1", "t-1", { name: "x" });

    expect(result).toEqual({ ok: false, message: "Task not found." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await updateTask("org-1", "p-1", "t-1", { name: "x" });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
