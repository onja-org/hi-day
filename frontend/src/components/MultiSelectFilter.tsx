"use client";

import { useRef, useState } from "react";
import { CaretDownIcon, XIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useDismissOnOutside } from "@/hooks/useDismissOnOutside";

type Option = { id: string; name: string };

type MultiSelectFilterProps = {
  label: string;
  placeholder: string;
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
};

/**
 * A filter that takes several values at once, shown as removable chips in a
 * control styled like the panel's plain selects.
 *
 * Not a native `<select multiple>`: that renders as a permanently-open
 * scrolling box with ctrl-click semantics most people never discover, and it
 * can't show what's chosen once it's scrolled.
 */
export function MultiSelectFilter({
  label,
  placeholder,
  options,
  selected,
  onChange,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismissOnOutside(isOpen, [containerRef], () => setIsOpen(false));

  const chosen = options.filter((option) => selected.includes(option.id));

  function toggle(id: string): void {
    onChange(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-slate-900/60 uppercase">
        {label}
      </span>

      <div ref={containerRef} className="relative">
        <div
          className={clsx(
            "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border bg-white px-2 py-1.5",
            isOpen ? "border-primary" : "border-input-border",
          )}
        >
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-label={label}
            className="flex flex-1 cursor-pointer items-center gap-1.5 text-left"
          >
            {chosen.length === 0 && (
              <span className="text-sm text-slate-900/40">{placeholder}</span>
            )}
          </button>

          {/* After the trigger in the DOM but before it visually, so each
              chip's remove button stays its own target rather than being
              swallowed by the button that opens the list. */}
          {chosen.map((option) => (
            <span
              key={option.id}
              className="order-first flex items-center gap-1 rounded-md border border-input-border bg-cream px-2 py-0.5 text-xs text-primary-dark"
            >
              {option.name}
              <button
                type="button"
                onClick={() => toggle(option.id)}
                aria-label={`Remove ${option.name}`}
                className="cursor-pointer text-primary-dark hover:text-primary"
              >
                <XIcon size={11} aria-hidden="true" />
              </button>
            </span>
          ))}

          {chosen.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              aria-label={`Clear ${label}`}
              className="cursor-pointer text-slate-900/40 hover:text-primary"
            >
              <XIcon size={13} aria-hidden="true" />
            </button>
          )}
          <CaretDownIcon
            size={13}
            aria-hidden="true"
            className="text-slate-900/40"
          />
        </div>

        {isOpen && (
          <ul
            role="listbox"
            aria-multiselectable="true"
            className="absolute top-full right-0 left-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-md border border-input-border bg-white shadow-lg"
          >
            {options.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-900/60">
                Nothing to choose from.
              </li>
            )}
            {options.map((option) => {
              const isSelected = selected.includes(option.id);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(option.id)}
                    className={clsx(
                      "w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors duration-150",
                      isSelected
                        ? "bg-primary text-white"
                        : "text-slate-900 hover:bg-cream",
                    )}
                  >
                    {option.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
