import { afterEach, describe, expect, it, vi } from "vitest";
import { getReport } from "@/lib/getReport";

describe("getReport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the report rows on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([{ key: "m-1", label: "Alice", seconds: 3600 }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getReport("org-1", {
      groupBy: "person",
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-07T23:59:59.000Z"),
    });

    expect(result).toEqual({
      ok: true,
      rows: [{ key: "m-1", label: "Alice", seconds: 3600 }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/reports?groupBy=person&from=2026-01-01T00%3A00%3A00.000Z&to=2026-01-07T23%3A59%3A59.000Z",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "groupBy must be one of: person, project" }),
      }),
    );

    const result = await getReport("org-1", {
      groupBy: "person",
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-07T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: false,
      message: "groupBy must be one of: person, project",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getReport("org-1", {
      groupBy: "project",
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-07T00:00:00.000Z"),
    });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
