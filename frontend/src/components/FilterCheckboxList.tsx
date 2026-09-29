"use client";

import { useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";

type FilterOption = { id: string; name: string };

type FilterCheckboxListProps = {
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  /** Adds a search box. Worth it for projects, noise for a four-item list. */
  searchable?: boolean;
  emptyLabel: string;
};

/** One checkable section of the filter panel. Selecting nothing means "don't
 * narrow by this", which is why there is no explicit "All" option. */
export function FilterCheckboxList({
  label,
  options,
  selected,
  onToggle,
  onSelectAll,
  searchable,
  emptyLabel,
}: FilterCheckboxListProps) {
  const [search, setSearch] = useState("");
  const visible = search
    ? options.filter((option) =>
        option.name.toLowerCase().includes(search.toLowerCase()),
      )
    : options;
  const allVisibleSelected =
    visible.length > 0 && visible.every((option) => selected.has(option.id));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-medium tracking-wide text-slate-900/60 uppercase">
        {label}
      </legend>

      {searchable && options.length > 0 && (
        <label className="flex items-center gap-2 rounded-md border border-input-border px-3 py-2">
          <MagnifyingGlassIcon size={14} aria-hidden="true" className="text-icon" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}`}
            className="w-full text-sm text-slate-900 focus:outline-none"
          />
        </label>
      )}

      {options.length === 0 ? (
        <p className="text-sm text-slate-900/60">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {visible.length > 1 && (
            <button
              type="button"
              onClick={() => onSelectAll(visible.map((option) => option.id))}
              className="cursor-pointer self-start text-xs font-medium text-primary hover:underline"
            >
              {allVisibleSelected ? "Clear these" : "Select all"}
            </button>
          )}
          {visible.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-slate-900 hover:bg-cream"
            >
              <input
                type="checkbox"
                checked={selected.has(option.id)}
                onChange={() => onToggle(option.id)}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              {option.name}
            </label>
          ))}
          {visible.length === 0 && (
            <p className="text-sm text-slate-900/60">Nothing matches that search.</p>
          )}
        </div>
      )}
    </fieldset>
  );
}
