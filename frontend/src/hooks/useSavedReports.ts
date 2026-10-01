import { useCallback, useMemo, useSyncExternalStore } from "react";
import { parseSavedReports, removeSavedReport, upsertSavedReport } from "@/lib/savedReports";
import type { ReportSchedule } from "@/types/reportSchedule";
import type { SavedReport, SavedReportSettings } from "@/types/savedReport";

const CHANGE_EVENT = "saved-reports-change";

type SaveInput = {
  /** Pass to update an existing report instead of adding a new one. */
  id?: string;
  name: string;
  scheduled: boolean;
  settings: SavedReportSettings;
  schedule?: ReportSchedule;
};

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function readRaw(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/**
 * The reports this user saved in one organisation, kept in localStorage —
 * so they stay in this browser, not on the account — shared between the
 * report page, the Customised reports list and the sidebar (same tab via a
 * custom event, other tabs via `storage`). `isReady` is false during server
 * rendering and hydration, when storage can't be read yet, so a page can
 * tell "not loaded" from "no such report". The snapshot is the raw string so
 * `useSyncExternalStore` compares by value.
 */
export function useSavedReports(organisationId: string) {
  const key = `saved-reports:${organisationId}`;
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
  const reports = useMemo(() => parseSavedReports(raw), [raw]);

  const write = useCallback(
    (next: SavedReport[]) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        return;
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );

  /** Returns the saved report's id. */
  const saveReport = useCallback(
    (input: SaveInput): string => {
      const id = input.id ?? crypto.randomUUID();
      write(
        upsertSavedReport(parseSavedReports(readRaw(key)), {
          id,
          name: input.name,
          reportType: "time-and-activity",
          settings: input.settings,
          scheduled: input.scheduled,
          schedule: input.schedule,
          modifiedAt: new Date().toISOString(),
        }),
      );
      return id;
    },
    [key, write],
  );

  const deleteReport = useCallback(
    (id: string) => write(removeSavedReport(parseSavedReports(readRaw(key)), id)),
    [key, write],
  );

  return { reports, isReady: raw !== null, saveReport, deleteReport };
}
