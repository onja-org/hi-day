"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { useDismissOnOutside } from "@/hooks/useDismissOnOutside";

type ActionsMenuItem = {
  label: string;
  /** Navigates instead of running `onSelect` when set. */
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** Title shown on hover, e.g. why an item is disabled. */
  title?: string;
  tone?: "danger";
};

type ActionsMenuProps = {
  items: ActionsMenuItem[];
  label?: string;
  /** Which edge the menu lines up with — "left" for a menu at the start of a row. */
  align?: "left" | "right";
};

/** Must match the panel's `w-52` (13rem). Used to align it to its trigger. */
const MENU_WIDTH_PX = 208;
/** Approximate height of one item row and of the panel's vertical padding. */
const MENU_ITEM_HEIGHT_PX = 44;
const MENU_PADDING_PX = 16;
const MENU_GAP_PX = 4;

type MenuPosition = { top: number; left: number };

/** An "Actions ▾" button that opens a list of row actions. Items close the
 * menu before running, so anything they open (e.g. a modal) must be
 * rendered by the caller, outside this menu.
 *
 * The panel is portalled to `document.body` and fixed-positioned from the
 * trigger's rect: tables sit in an `overflow-x-auto` container, which would
 * otherwise clip it or turn it into scrollable overflow. The inline `style`
 * carries only the runtime coordinates; as in `TimeEntryActionsMenu`, they
 * can't be classes. */
export function ActionsMenu({ items, label = "Actions", align = "right" }: ActionsMenuProps) {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const open = position !== null;
  const close = useCallback(() => setPosition(null), []);
  useDismissOnOutside(open, [triggerRef, panelRef], close, true);

  function toggle() {
    if (open) {
      close();
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const height = items.length * MENU_ITEM_HEIGHT_PX + MENU_PADDING_PX;
    const fitsBelow = rect.bottom + MENU_GAP_PX + height <= window.innerHeight;
    setPosition({
      top: fitsBelow ? rect.bottom + MENU_GAP_PX : rect.top - MENU_GAP_PX - height,
      left: align === "right" ? rect.right - MENU_WIDTH_PX : rect.left,
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        className={clsx(
          "flex h-11 cursor-pointer items-center gap-1.5 rounded-brand-sm border-2 px-3 text-sm font-semibold text-primary-dark transition-colors duration-150 hover:border-primary hover:text-primary",
          open && "border-primary text-primary",
          !open && "border-ink",
        )}
      >
        {label}
        <CaretDown size={14} aria-hidden="true" />
      </button>

      {position &&
        createPortal(
        <ul
          ref={panelRef}
          style={{ top: position.top, left: position.left }}
          className="fixed z-50 flex w-52 flex-col rounded-brand-sm border-2 border-ink bg-white py-2 text-left shadow-hard-sm"
        >
          {items.map((item) => (
            <li key={item.label}>
              {item.href && !item.disabled ? (
                <Link
                  href={item.href}
                  onClick={close}
                  className="block px-5 py-2.5 text-sm text-slate-900 transition-colors duration-150 hover:bg-cream"
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={item.disabled}
                  title={item.title}
                  onClick={() => {
                    close();
                    item.onSelect?.();
                  }}
                  className={clsx(
                    "block w-full cursor-pointer px-5 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white",
                    item.tone === "danger" && "text-error",
                    item.tone !== "danger" && "text-slate-900",
                  )}
                >
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>,
          document.body,
        )}
    </>
  );
}
