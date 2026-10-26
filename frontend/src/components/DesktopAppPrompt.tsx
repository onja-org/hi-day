"use client";

import { DownloadSimple, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useDesktopAppPrompt } from "@/hooks/useDesktopAppPrompt";

/** A dismissible corner card pointing users without a paired Device at
 * /download. Not shown on phone widths, where there's nothing to install. */
export function DesktopAppPrompt() {
  const { visible, dismiss } = useDesktopAppPrompt();

  if (!visible) return null;

  return (
    <aside
      aria-label="Desktop app"
      className="fixed right-6 bottom-6 z-30 hidden w-80 flex-col gap-3 rounded-brand-sm border-2 border-ink bg-white p-4 shadow-hard-sm sm:flex"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-brand-sm border-2 border-ink bg-sun">
          <DownloadSimple size={20} aria-hidden="true" />
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="cursor-pointer text-icon transition-colors duration-150 hover:text-primary-dark"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-slate-900">Get the desktop app</h2>
        <p className="text-sm text-ink-muted">
          Track your time and activity from your computer. Sign in from the
          app to link it to your account.
        </p>
      </div>
      <Link
        href="/download"
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
        className="flex h-11 items-center justify-center rounded-brand-sm border-2 border-ink bg-primary px-4 font-bold text-white transition-colors duration-150 hover:bg-primary/90"
      >
        Download
      </Link>
    </aside>
  );
}
