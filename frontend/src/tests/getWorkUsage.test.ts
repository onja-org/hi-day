import { afterEach, describe, expect, it, vi } from "vitest";
import { getWorkUsage } from "@/lib/getWorkUsage";

const ITEMS = [{ kind: "app", name: "Code", secondsSpent: 60, label: "core" }];

describe("getWorkUsage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the organisation's apps and sites", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(ITEMS) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getWorkUsage("100000")).resolves.toEqual({ ok: true, message: "", items: ITEMS });
    expect(new URL(fetchMock.mock.calls[0][0] as string, "http://localhost").pathname).toBe(
      "/api/backend/organisations/100000/work-classification",
    );
  });

  it("passes the server's message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: "Forbidden" }) }),
    );

    await expect(getWorkUsage("100000")).resolves.toEqual({ ok: false, message: "Forbidden" });
  });

  it("falls back to a generic message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await getWorkUsage("100000");
    expect(result.ok).toBe(false);
  });
});
