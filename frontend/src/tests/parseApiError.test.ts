import { describe, expect, it } from "vitest";
import {
  GENERIC_ERROR_MESSAGE,
  parseApiErrorMessage,
} from "@/lib/parseApiError";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body));
}

describe("parseApiErrorMessage", () => {
  it("returns a string message as-is", async () => {
    const message = await parseApiErrorMessage(
      jsonResponse({ message: "Task name is required" }),
    );
    expect(message).toBe("Task name is required");
  });

  it("takes the first entry of an array message", async () => {
    const message = await parseApiErrorMessage(
      jsonResponse({ message: ["Name is required", "Estimate must be a number"] }),
    );
    expect(message).toBe("Name is required");
  });

  it("falls back to the generic message when there is no message field", async () => {
    const message = await parseApiErrorMessage(jsonResponse({}));
    expect(message).toBe(GENERIC_ERROR_MESSAGE);
  });

  it("falls back to the generic message when the body isn't valid JSON", async () => {
    const message = await parseApiErrorMessage(new Response("not json"));
    expect(message).toBe(GENERIC_ERROR_MESSAGE);
  });
});
