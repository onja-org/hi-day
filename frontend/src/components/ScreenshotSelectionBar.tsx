"use client";

import { createPortal } from "react-dom";
import { TrashIcon, XIcon } from "@phosphor-icons/react";

type ScreenshotSelectionBarProps = {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
};

/**
 * Floats over the gallery so the actions stay reachable however far down
 * the grid the selection was made. Portalled into document.body for the
 * same reason Modal is: the dashboard shell wraps every page in FadeIn,
 * whose translate classes make it the containing block for `fixed`, which
 * would otherwise pin this to the bottom of the *page* and scroll it away.
 */
export function ScreenshotSelectionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClear,
  onDelete,
}: ScreenshotSelectionBarProps) {
  return createPortal(
    <div
      role="toolbar"
      aria-label="Selected screenshots"
      className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-brand-sm border-2 border-ink bg-white px-3 py-3 shadow-hard sm:gap-6 sm:px-4"
    >
      <span
        aria-live="polite"
        className="text-xs font-semibold whitespace-nowrap text-slate-900 sm:text-sm"
      >
        {selectedCount} {selectedCount === 1 ? "screenshot" : "screenshots"}{" "}
        selected
      </span>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete the ${selectedCount} selected screenshots`}
        className="cursor-pointer rounded-brand-sm p-1 text-error transition-colors duration-150 hover:bg-error/10"
      >
        <TrashIcon size={20} aria-hidden="true" />
      </button>

      <div className="flex items-center gap-3">
        {selectedCount < totalCount && (
          <button
            type="button"
            onClick={onSelectAll}
            className="cursor-pointer text-xs font-semibold whitespace-nowrap text-primary hover:underline sm:text-sm"
          >
            Select all
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear the selection"
          className="cursor-pointer rounded-full p-1 text-slate-900 transition-colors duration-150 hover:bg-cream"
        >
          <XIcon size={18} aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
