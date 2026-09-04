import { afterEach, describe, expect, it, vi } from "vitest";
import { closeTask } from "@/lib/closeTask";

describe("closeTask", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the closed task on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "t-1", status: "closed" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await closeTask("org-1", "p-1", "t-1");

    expect(result).toEqual({ ok: true, task: { id: "t-1", status: "closed" } });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/tasks/t-1/close",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "Only the assignee or a project admin can close or reopen this task.",
          }),
      }),
    );

    const result = await closeTask("org-1", "p-1", "t-1");

    expect(result).toEqual({
      ok: false,
      message: "Only the assignee or a project admin can close or reopen this task.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await closeTask("org-1", "p-1", "t-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
