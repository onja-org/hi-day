import { afterEach, describe, expect, it, vi } from "vitest";
import { setWorkLabel } from "@/lib/setWorkLabel";

describe("setWorkLabel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("puts the label for one app or site", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(setWorkLabel("100000", { kind: "site", name: "github.com", label: "core" })).resolves.toEqual({
      ok: true,
      message: "",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/organisations/100000/work-classification");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ kind: "site", name: "github.com", label: "core" });
  });

  it("passes the server's first message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: ["label must be one of"] }) }),
    );

    await expect(setWorkLabel("100000", { kind: "app", name: "Code", label: "core" })).resolves.toEqual({
      ok: false,
      message: "label must be one of",
    });
  });
});
