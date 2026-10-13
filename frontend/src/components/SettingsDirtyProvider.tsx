"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type SettingsDirtyValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  /** True to go ahead — asks first when there is unsaved work. For moves
   * that aren't links, like switching a section's sub-panel. */
  confirmLeave: () => boolean;
};

const SettingsDirtyContext = createContext<SettingsDirtyValue>({
  isDirty: false,
  setDirty: () => {},
  confirmLeave: () => true,
});

const LEAVE_MESSAGE = "Leave without saving? Your changes will be lost.";

export function useSettingsDirty(): SettingsDirtyValue {
  return useContext(SettingsDirtyContext);
}

/**
 * Tracks whether the section on screen has unsaved edits, so moving between
 * sections can ask first. Leaving a section, or switching one of its
 * sub-panels, discards whatever was typed with nothing to show for it.
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
      // A modified click opens a new tab or window and leaves this page as
      // it is — nothing to lose.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link =
        event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      ) {
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
    <SettingsDirtyContext
      value={{
        isDirty,
        setDirty,
        confirmLeave: () => !isDirty || window.confirm(LEAVE_MESSAGE),
      }}
    >
      {children}
    </SettingsDirtyContext>
  );
}
