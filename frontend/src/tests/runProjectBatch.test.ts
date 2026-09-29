import { describe, expect, it, vi } from "vitest";
import { runProjectBatch } from "@/lib/runProjectBatch";

describe("runProjectBatch", () => {
  it("reports each project's outcome without stopping at a failure", async () => {
    const action = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: "A timer is running." })
      .mockResolvedValueOnce({ ok: true, message: "Project archived" });

    const result = await runProjectBatch(
      [
        { id: "p-1", name: "Website" },
        { id: "p-2", name: "Portal" },
      ],
      action,
      "Archived",
    );

    expect(result).toEqual({
      ok: false,
      message: "Archived 1 of 2 projects",
      outcomes: [
        { projectId: "p-1", name: "Website", ok: false, message: "A timer is running." },
        { projectId: "p-2", name: "Portal", ok: true, message: "Project archived" },
      ],
    });
  });

  it("is ok with a singular message when the only project succeeds", async () => {
    const result = await runProjectBatch(
      [{ id: "p-1", name: "Website" }],
      async () => ({ ok: true, message: "Project deleted" }),
      "Deleted",
    );
    expect(result.ok).toBe(true);
    expect(result.message).toBe("Deleted 1 of 1 project");
  });

  it("runs the requests one after another, in order", async () => {
    const order: string[] = [];
    let inFlight = 0;
    const action = vi.fn(async (project: { id: string; name: string }) => {
      inFlight += 1;
      expect(inFlight).toBe(1);
      await Promise.resolve();
      order.push(project.id);
      inFlight -= 1;
      return { ok: true, message: "done" };
    });

    await runProjectBatch(
      [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
      ],
      action,
      "Updated",
    );

    expect(order).toEqual(["a", "b", "c"]);
  });
});
