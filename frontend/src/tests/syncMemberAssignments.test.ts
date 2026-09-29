import { afterEach, describe, expect, it, vi } from "vitest";
import { syncMemberAssignments } from "@/lib/syncMemberAssignments";

const names: Record<string, string> = { "t-1": "Design", "t-2": "Backend", "p-1": "Website" };
const nameOf = (id: string) => names[id] ?? id;

function okResponse() {
  return { ok: true, json: () => Promise.resolve({ message: "ok" }) };
}

describe("syncMemberAssignments", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("issues no requests when nothing changed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncMemberAssignments(
      "org-1",
      "m-1",
      { original: ["t-1"], target: ["t-1"] },
      { original: ["p-1"], target: ["p-1"] },
      nameOf,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ failures: [] });
  });

  it("adds and removes only what changed, against the team and project endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await syncMemberAssignments(
      "org-1",
      "m-1",
      { original: ["t-1"], target: ["t-2"] },
      { original: [], target: ["p-1"] },
      nameOf,
    );

    const calls = fetchMock.mock.calls.map(([url, init]) => [url, init.method]);
    expect(calls).toEqual(
      expect.arrayContaining([
        ["/api/backend/organisations/org-1/teams/t-2/members", "POST"],
        ["/api/backend/organisations/org-1/teams/t-1/members/m-1", "DELETE"],
        ["/api/backend/organisations/org-1/projects/p-1/members", "POST"],
      ]),
    );
    expect(calls).toHaveLength(3);
  });

  it("reports each failed change by name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Not allowed." }),
      }),
    );

    const result = await syncMemberAssignments(
      "org-1",
      "m-1",
      { original: [], target: ["t-1"] },
      { original: ["p-1"], target: [] },
      nameOf,
    );

    expect(result.failures).toEqual([
      "Couldn't add to Design: Not allowed.",
      "Couldn't remove from Website: Not allowed.",
    ]);
  });
});
