import { afterEach, describe, expect, it, vi } from "vitest";
import { reopenTask } from "@/lib/reopenTask";

describe("reopenTask", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the reopened task on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          task: { id: "t-1", status: "open" },
          message: "Task reopened",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await reopenTask("org-1", "p-1", "t-1");

    expect(result).toEqual({
      ok: true,
      task: { id: "t-1", status: "open" },
      message: "Task reopened",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/tasks/t-1/reopen",
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
            message: "This project is archived — unarchive it first to make changes.",
          }),
      }),
    );

    const result = await reopenTask("org-1", "p-1", "t-1");

    expect(result).toEqual({
      ok: false,
      message: "This project is archived — unarchive it first to make changes.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await reopenTask("org-1", "p-1", "t-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
