import { describe, expect, it } from "vitest";
import { devicePlatformLabel } from "@/lib/devicePlatformLabel";

describe("devicePlatformLabel", () => {
  it("maps each platform to its display label", () => {
    expect(devicePlatformLabel("windows")).toBe("Windows");
    expect(devicePlatformLabel("macos")).toBe("macOS");
    expect(devicePlatformLabel("linux")).toBe("Linux");
    expect(devicePlatformLabel("ios")).toBe("iOS");
    expect(devicePlatformLabel("android")).toBe("Android");
  });
});
