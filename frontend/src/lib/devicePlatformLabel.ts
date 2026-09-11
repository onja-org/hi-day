import type { DevicePlatform } from "@/types/device";

const PLATFORM_LABELS: Record<DevicePlatform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  ios: "iOS",
  android: "Android",
};

export function devicePlatformLabel(platform: DevicePlatform): string {
  return PLATFORM_LABELS[platform];
}
