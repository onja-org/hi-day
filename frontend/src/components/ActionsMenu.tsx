"use client";

import { useCallback, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { useDismissOnOutsideClick } from "@/hooks/useDismissOnOutsideClick";

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

/** An "Actions ▾" button that opens a list of row actions. Items close the
 * menu before running, so anything they open (e.g. a modal) must be
 * rendered by the caller, outside this menu. */
export function ActionsMenu({ items, label = "Actions", align = "right" }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismissOnOutsideClick(menuRef, open, close);

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className={clsx(
          "flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-primary-dark transition-colors duration-150 hover:border-primary hover:text-primary",
          open && "border-primary text-primary",
          !open && "border-input-border",
        )}
      >
        {label}
        <CaretDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <ul
          className={clsx(
            "absolute top-full z-30 mt-1 flex w-60 flex-col rounded-md border border-primary-dark/10 bg-white py-1 shadow-lg",
            align === "right" && "right-0",
            align === "left" && "left-0",
          )}
        >
          {items.map((item) => (
            <li key={item.label}>
              {item.href && !item.disabled ? (
                <Link
                  href={item.href}
                  onClick={close}
                  className="block px-4 py-2 text-sm text-slate-900 transition-colors duration-150 hover:bg-cream"
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
                    "block w-full cursor-pointer px-4 py-2 text-left text-sm transition-colors duration-150 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white",
                    item.tone === "danger" && "text-error",
                    item.tone !== "danger" && "text-slate-900",
                  )}
                >
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
