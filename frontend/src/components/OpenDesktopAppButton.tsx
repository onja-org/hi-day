"use client";

import { DesktopIcon } from "@phosphor-icons/react";

const DEEP_LINK = "hiday://open";

/**
 * Raises the installed desktop app through the `hiday://` scheme its main
 * process registers. The app is normally already running and polling for
 * the approval, so this saves hunting for its window.
 *
 * Assigned in the click handler rather than left to the href: Chrome
 * refuses an external-protocol launch it can't attribute to a user
 * gesture. The href stays for middle-click and screen readers.
 */
export function OpenDesktopAppButton() {
  return (
    <a
      href={DEEP_LINK}
      onClick={(event) => {
        event.preventDefault();
        window.location.href = DEEP_LINK;
      }}
      className="flex h-11 items-center justify-center gap-2 rounded-brand-sm border-2 border-ink bg-primary/90 px-4 font-bold text-white transition-all duration-150 hover:scale-105 hover:bg-primary active:scale-95"
    >
      <DesktopIcon size={18} aria-hidden="true" />
      Open Hi Day
    </a>
  );
}
