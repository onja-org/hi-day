"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";
import clsx from "clsx";

type MultiSelectDropdownProps = {
  id: string;
  label: string;
  triggerText: string;
  children: ReactNode;
  disabled?: boolean;
};

/** A closed-by-default dropdown whose panel holds arbitrary checkable rows —
 * used where a native `<select multiple>` would be the right control except
 * that browsers give no reliable way to style `<option>` padding/spacing.
 * Follows the same click-outside-to-close pattern as UserMenu. */
export function MultiSelectDropdown({
  id,
  label,
  triggerText,
  children,
  disabled,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={id}>{label}</label>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-input-border bg-white px-3 py-2 text-left text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {triggerText}
        <CaretDown
          size={16}
          aria-hidden="true"
          className={clsx(
            "shrink-0 text-slate-900/50 transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-2 w-full rounded-md border border-input-border bg-white p-3 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}
