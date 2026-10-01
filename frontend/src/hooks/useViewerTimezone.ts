import { useSyncExternalStore } from "react";
import { detectTimezone } from "@/lib/timezone";

/** Cached so `getSnapshot` stays referentially stable — recomputing would
 * re-render forever, and the browser's zone can't change mid-session. */
let cached: string | null = null;

function getSnapshot(): string {
  cached ??= detectTimezone();
  return cached;
}

/** Never subscribes: there is nothing to change. */
function subscribe(): () => void {
  return () => undefined;
}

/**
 * The browser's own timezone — what "my time zone" means. Null while server
 * rendering, where the server's zone would disagree with the client's on
 * hydration; callers show a neutral label until it arrives.
 */
export function useViewerTimezone(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
