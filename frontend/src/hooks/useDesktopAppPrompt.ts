import { useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { isDesktopAppPromptSnoozed } from "@/lib/desktopAppPromptSnooze";
import { getMyDevices } from "@/lib/getMyDevices";

const STORAGE_KEY = "desktop-app-prompt-dismissed-at";
const CHANGE_EVENT = "desktop-app-prompt-change";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function readSnoozed(): boolean {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  return isDesktopAppPromptSnoozed(raw, Date.now());
}

/**
 * Whether to nudge the user towards the desktop app: only once they're known
 * to have never paired a Device, and not again for a while after they
 * dismiss it (kept in localStorage, so per browser; other tabs follow via
 * `storage`). Hidden during server rendering and hydration, while the
 * Devices load, and if they fail to — it's a nudge, not worth an error.
 */
export function useDesktopAppPrompt() {
  const snoozed = useSyncExternalStore(subscribe, readSnoozed, () => true);
  const devicesQuery = useQuery({
    queryKey: ["my-devices"],
    queryFn: async () => {
      const result = await getMyDevices();
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.devices;
    },
    enabled: !snoozed,
  });

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const visible =
    !snoozed && devicesQuery.isSuccess && devicesQuery.data.length === 0;

  return { visible, dismiss };
}
