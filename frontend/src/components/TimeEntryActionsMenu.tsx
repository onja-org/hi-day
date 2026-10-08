"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDownIcon } from "@phosphor-icons/react";
import { useDismissOnOutside } from "@/hooks/useDismissOnOutside";
import {
  entryEditBlockedReason,
  entrySplitBlockedReason,
} from "@/lib/entryEditBlockedReason";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { ActionsMenuItem } from "./ActionsMenuItem";
import { TimeEntryDeleteModal } from "./TimeEntryDeleteModal";
import { TimeEntrySplitModal } from "./TimeEntrySplitModal";

type TimeEntryActionsMenuProps = {
  organisationId: string;
  entry: TimeEntryListItem;
  onEdit: (entry: TimeEntryListItem) => void;
};

/** Must match the panel's `w-36` (9rem) and its rendered height. Used to
 * right-align the panel to its trigger and to decide whether it fits below. */
const MENU_WIDTH_PX = 144;
const MENU_HEIGHT_PX = 120;
const MENU_GAP_PX = 4;

type MenuPosition = { top: number; left: number };

/**
 * The row's Edit, Split and Delete actions behind one "Actions" control.
 * Edit and Split need `canEdit` (admin); Delete needs `canDelete`, which an
 * entry's own owner also has — so a row offering only Delete is normal.
 *
 * The panel is portalled to `document.body`: the table sits in an
 * `overflow-x-auto` container, and CSS forces the vertical axis to `auto`
 * alongside it, so an in-tree panel became scrollable overflow and made the
 * table scroll to reach its own menu.
 *
 * That makes this the one place in the codebase with an inline `style`,
 * which `frontend/CLAUDE.md` otherwise forbids — the coordinates are read
 * from the trigger at runtime and can't be classes. Only `top`/`left` are
 * inline; every appearance rule stays in Tailwind.
 */
export function TimeEntryActionsMenu({
  organisationId,
  entry,
  onEdit,
}: TimeEntryActionsMenuProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const editBlocked = entryEditBlockedReason(entry);
  const splitBlocked = entrySplitBlockedReason(entry);

  useDismissOnOutside(
    position !== null,
    [triggerRef, panelRef],
    () => setPosition(null),
    true,
  );

  function toggle() {
    if (position) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const fitsBelow = rect.bottom + MENU_GAP_PX + MENU_HEIGHT_PX <= window.innerHeight;
    setPosition({
      top: fitsBelow
        ? rect.bottom + MENU_GAP_PX
        : rect.top - MENU_GAP_PX - MENU_HEIGHT_PX,
      left: rect.right - MENU_WIDTH_PX,
    });
  }

  // Someone viewing another person's timesheet without being an admin has
  // no action at all on these rows.
  if (!entry.canEdit && !entry.canDelete) {
    return null;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={position !== null}
        aria-haspopup="menu"
        className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-brand-sm border-2 border-ink px-3 text-sm font-semibold text-slate-900 transition-colors duration-150 hover:border-primary hover:text-primary"
      >
        Actions
        <CaretDownIcon size={11} aria-hidden="true" />
      </button>

      {position &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ top: position.top, left: position.left }}
            className="fixed z-50 flex w-36 flex-col items-stretch rounded-brand-sm border-2 border-ink bg-white shadow-hard-sm"
          >
            <ActionsMenuItem
              label="Edit"
              disabled={editBlocked !== undefined}
              title={editBlocked}
              onSelect={() => {
                setPosition(null);
                onEdit(entry);
              }}
            />
            <ActionsMenuItem
              label="Split"
              disabled={splitBlocked !== undefined}
              title={splitBlocked}
              onSelect={() => {
                setPosition(null);
                setIsSplitting(true);
              }}
            />
            <ActionsMenuItem
              label="Delete"
              isDangerous
              disabled={!entry.canDelete}
              title={
                entry.canDelete ? undefined : "You can only delete your own entries."
              }
              onSelect={() => {
                setPosition(null);
                setIsConfirming(true);
              }}
            />
          </div>,
          document.body,
        )}

      {isSplitting && (
        <TimeEntrySplitModal
          organisationId={organisationId}
          entry={entry}
          onClose={() => setIsSplitting(false)}
        />
      )}

      {isConfirming && (
        <TimeEntryDeleteModal
          organisationId={organisationId}
          entry={entry}
          onClose={() => setIsConfirming(false)}
        />
      )}
    </>
  );
}
