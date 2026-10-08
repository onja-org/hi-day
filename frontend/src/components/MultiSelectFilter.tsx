"use client";

import { useRef, useState } from "react";
import {
  CaretDownIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useDismissOnOutside } from "@/hooks/useDismissOnOutside";

type Option = { id: string; name: string };

type MultiSelectFilterProps = {
  label: string;
  placeholder: string;
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Adds a search box to the list. Opt-in rather than automatic: it earns
   * its place on a project list that grows with the organisation, and is
   * noise on a fixed four-item one. */
  searchable?: boolean;
  /** Shown when there is nothing to choose from at all. */
  emptyLabel?: string;
  /** Holds one value at a time: picking replaces rather than adds. Used
   * where several choices could not mean anything — activity thresholds
   * nest, so "> 90%" and "> 60%" together would only ever mean "> 60%". */
  single?: boolean;
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
  searchable,
  emptyLabel = "Nothing to choose from.",
  single,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  useDismissOnOutside(isOpen, [containerRef], () => {
    setIsOpen(false);
    // Reset so reopening starts from the whole list.
    setSearch("");
  });

  const visible =
    searchable && search
      ? options.filter((option) =>
          option.name.toLowerCase().includes(search.toLowerCase()),
        )
      : options;

  const chosen = options.filter((option) => selected.includes(option.id));

  function toggle(id: string): void {
    if (single) {
      onChange(selected.includes(id) ? [] : [id]);
      return;
    }
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
            className="absolute top-full right-0 left-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-brand-sm border-2 border-ink bg-white shadow-hard-sm"
          >
            {searchable && (
              <li className="p-2">
                <span className="flex items-center gap-2 rounded-full border border-primary px-3 py-1.5">
                  <MagnifyingGlassIcon
                    size={14}
                    aria-hidden="true"
                    className="text-icon"
                  />
                  <input
                    type="search"
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Search ${label.toLowerCase()}`}
                    className="w-full text-sm text-slate-900 focus:outline-none"
                  />
                </span>
              </li>
            )}
            {options.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-900/60">{emptyLabel}</li>
            )}
            {options.length > 0 && visible.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-900/60">
                Nothing matches that search.
              </li>
            )}
            {visible.map((option) => {
              const isSelected = selected.includes(option.id);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      toggle(option.id);
                      if (single) setIsOpen(false);
                    }}
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
