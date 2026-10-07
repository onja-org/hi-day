"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type SettingsDirtyValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  /** True to go ahead — asks first when there is unsaved work. */
  confirmLeave: () => boolean;
};

const SettingsDirtyContext = createContext<SettingsDirtyValue>({
  isDirty: false,
  setDirty: () => {},
  confirmLeave: () => true,
});

export function useSettingsDirty(): SettingsDirtyValue {
  return useContext(SettingsDirtyContext);
}

/**
 * Tracks whether the section on screen has unsaved edits, so moving between
 * sections can ask first. Each section is its own route now, so navigating
 * away discards whatever was typed with nothing to show for it.
 */
export function SettingsDirtyProvider({ children }: { children: ReactNode }) {
  const [isDirty, setDirty] = useState(false);

  useEffect(() => {
    if (!isDirty) return;
    // Covers reloads and closing the tab; the in-app links ask through
    // `confirmLeave`, which the browser does not get a say in.
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  return (
    <SettingsDirtyContext
      value={{
        isDirty,
        setDirty,
        confirmLeave: () =>
          !isDirty ||
          window.confirm("Leave without saving? Your changes will be lost."),
      }}
    >
      {children}
    </SettingsDirtyContext>
  );
}
