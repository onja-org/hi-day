"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type SettingsDirtyValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
};

const SettingsDirtyContext = createContext<SettingsDirtyValue>({
  isDirty: false,
  setDirty: () => {},
});

const LEAVE_MESSAGE = "Leave without saving? Your changes will be lost.";

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
    // Covers reloads and closing the tab.
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    // In-app links navigate client-side, which `beforeunload` never sees —
    // the section tabs, the sidebar, the header. Caught in the capture phase
    // so it runs before the link's own navigation.
    const askOnLinkClick = (event: MouseEvent) => {
      const link =
        event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") {
        return;
      }
      const url = new URL(link.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", askOnLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", askOnLinkClick, true);
    };
  }, [isDirty]);

  return (
    <SettingsDirtyContext value={{ isDirty, setDirty }}>
      {children}
    </SettingsDirtyContext>
  );
}
