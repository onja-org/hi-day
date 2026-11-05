import { afterEach, describe, expect, it, vi } from "vitest";
import { getActivityScreenshots } from "@/lib/getActivityScreenshots";

const PAGE = {
  items: [
    {
      id: "screenshot-1",
      capturedAt: "2026-09-08T12:00:00.000Z",
      url: "https://view.example/get",
      projectId: "project-1",
    },
  ],
  total: 17,
  page: 2,
  pageSize: 8,
};

function stubOk() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(PAGE),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
  return new URL(fetchMock.mock.calls[0][0] as string, "http://localhost");
}

describe("getActivityScreenshots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the page the server sent", async () => {
    stubOk();

    const result = await getActivityScreenshots("org-1", {}, { page: 2 });

    expect(result).toEqual({ ok: true, page: PAGE });
  });

  it("asks for the caller's own screenshots, 8 at a time from page 1, by default", async () => {
    const fetchMock = stubOk();

    await getActivityScreenshots("org-1");

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/api/backend/organisations/org-1/screenshots/mine");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("pageSize")).toBe("8");
    expect(url.searchParams.has("order")).toBe(false);
  });

  // The dashboard previews: a different page size, latest first.
  it("asks for a custom page size, newest first", async () => {
    const fetchMock = stubOk();

    await getActivityScreenshots(
      "org-1",
      {},
      { page: 2, pageSize: 3, newestFirst: true },
    );

    const url = requestedUrl(fetchMock);
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("3");
    expect(url.searchParams.get("order")).toBe("newest");
  });

  it("asks for another member's screenshots on that member's route", async () => {
    const fetchMock = stubOk();

    await getActivityScreenshots(
      "org-1",
      { membershipId: "member-1" },
      { page: 3 },
    );

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe(
      "/api/backend/organisations/org-1/memberships/member-1/screenshots",
    );
    expect(url.searchParams.get("page")).toBe("3");
  });

  // Regression: the project filter used to be dropped whenever a date was
  // set — which on this page is always.
  it("sends the project filter alongside the date", async () => {
    const fetchMock = stubOk();

    await getActivityScreenshots("org-1", {
      date: "2026-09-08",
      projectId: "project-1",
    });

    const url = requestedUrl(fetchMock);
    expect(url.searchParams.get("date")).toBe("2026-09-08");
    expect(url.searchParams.get("projectId")).toBe("project-1");
  });

  it("leaves out filters that are not set", async () => {
    const fetchMock = stubOk();

    await getActivityScreenshots("org-1", {});

    const url = requestedUrl(fetchMock);
    expect(url.searchParams.has("date")).toBe(false);
    expect(url.searchParams.has("projectId")).toBe(false);
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: ["page must not be less than 1"] }),
      }),
    );

    const result = await getActivityScreenshots("org-1");

    expect(result).toEqual({
      ok: false,
      message: "page must not be less than 1",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getActivityScreenshots("org-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
