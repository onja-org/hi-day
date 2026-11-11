import { describe, expect, it } from "vitest";
import { parseTimeEntrySaveError } from "@/lib/parseTimeEntrySaveError";

function response(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as Response;
}

const overlap = {
  id: "te-1",
  projectName: "Website",
  startedAt: "2026-01-05T10:00:00.000Z",
  endedAt: "2026-01-05T11:00:00.000Z",
};

describe("parseTimeEntrySaveError", () => {
  it("returns the overlapping entries and whether they can be merged", async () => {
    const result = await parseTimeEntrySaveError(
      response({ message: "These times overlap…", overlaps: [overlap], canMerge: true }),
    );

    expect(result).toEqual({
      message: "These times overlap…",
      overlap: { overlaps: [overlap], canMerge: true },
    });
  });

  it("treats a missing canMerge as no merge", async () => {
    const result = await parseTimeEntrySaveError(
      response({ message: "overlap", overlaps: [overlap] }),
    );

    expect(result.overlap?.canMerge).toBe(false);
  });

  it("returns just the message for any other refusal", async () => {
    const result = await parseTimeEntrySaveError(
      response({ message: ["End time must be after the start time."] }),
    );

    expect(result).toEqual({ message: "End time must be after the start time." });
  });

  it("falls back to a generic message when the body is unreadable", async () => {
    const result = await parseTimeEntrySaveError({
      json: () => Promise.reject(new Error("not json")),
    } as unknown as Response);

    expect(result).toEqual({ message: "Something went wrong. Please try again." });
  });
});
