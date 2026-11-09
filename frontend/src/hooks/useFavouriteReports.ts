import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useMyProfile } from "@/hooks/useMyProfile";
import {
  favouriteReportsStorageKey,
  parseFavouriteReportIds,
  toggleFavouriteReportId,
} from "@/lib/favouriteReports";

const CHANGE_EVENT = "favourite-reports-change";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function readRaw(key: string | null): string | null {
  if (key === null) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * The reports this user starred in one organisation, kept in localStorage so
 * the "All reports" page and the sidebar's Reports group stay in sync (same
 * tab via a custom event, other tabs via `storage`). Empty during server
 * rendering and hydration, and until we know who is signed in — nothing is
 * read or written under a key that isn't theirs. The snapshot is the raw
 * string — a primitive — so `useSyncExternalStore` compares it by value
 * instead of re-rendering on a freshly parsed array every read.
 */
export function useFavouriteReports(organisationId: number) {
  const userId = useMyProfile().data?.id;
  const key = userId
    ? favouriteReportsStorageKey(organisationId, userId)
    : null;
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
  const favouriteIds = useMemo(() => parseFavouriteReportIds(raw), [raw]);

  const toggleFavourite = useCallback(
    (reportId: string) => {
      if (key === null) return;
      const next = toggleFavouriteReportId(
        parseFavouriteReportIds(readRaw(key)),
        reportId,
      );
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        return;
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );

  return { favouriteIds, toggleFavourite };
}
