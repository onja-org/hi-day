import { useSyncExternalStore } from "react";
import { detectTimezone } from "@/lib/timezone";

/** Cached so `getSnapshot` returns a stable value — recomputing it would
 * re-render forever. The browser's zone does not change mid-session. */
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
 * The browser's own timezone — what "my time zone" means.
 *
 * `null` during server rendering, deliberately: the server's zone is not the
 * viewer's, and returning it would make the hydrated markup disagree with
 * the server's. Callers show a neutral label until it arrives.
 */
export function useViewerTimezone(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
