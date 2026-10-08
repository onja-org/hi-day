"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import clsx from "clsx";
import { splitOnMatch } from "@/lib/splitOnMatch";

export type SearchableSelectOption = { value: string; label: string };

type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  noMatchesLabel?: string;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  ariaLabel,
  placeholder = "Search…",
  noMatchesLabel = "No matches",
}: SearchableSelectProps) {
  const listboxId = useId();
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase()),
  );
  const filteredOptions = isOpen ? matches : options;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeAndReset();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function closeAndReset() {
    setIsOpen(false);
    setQuery("");
  }

  function clearQuery() {
    setQuery("");
    setHighlightedIndex(0);
    inputRef.current?.focus();
  }

  function selectOption(option: SearchableSelectOption) {
    onChange(option.value);
    closeAndReset();
    inputRef.current?.blur();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        Math.min(current + 1, filteredOptions.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) {
        selectOption(option);
      }
    } else if (event.key === "Escape") {
      closeAndReset();
      inputRef.current?.blur();
    }
  }

  const activeOption = isOpen ? filteredOptions[highlightedIndex] : undefined;

  return (
    <div ref={containerRef} className="relative w-56">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeOption
              ? `${listboxId}-${activeOption.value || "empty"}`
              : undefined
          }
          aria-label={ariaLabel}
          value={isOpen ? query : (selectedOption?.label ?? "")}
          onFocus={() => {
            setIsOpen(true);
            setQuery("");
            setHighlightedIndex(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-11 w-full rounded-brand-sm border-2 border-ink bg-white px-3 pr-8 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {isOpen && query ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearQuery}
            aria-label="Clear search"
            className="absolute right-2 flex cursor-pointer items-center text-icon hover:text-primary-dark"
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : (
          <MagnifyingGlass
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 text-icon"
          />
        )}
      </div>
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-brand-sm border-2 border-ink bg-white py-1 text-sm shadow-hard-sm"
        >
          {query && filteredOptions.length === 0 && (
            <li className="px-3 py-1.5 text-slate-900/60">{noMatchesLabel}</li>
          )}
          {filteredOptions.map((option, index) => (
            <li
              key={option.value || "empty"}
              id={`${listboxId}-${option.value || "empty"}`}
              role="option"
              aria-selected={option.value === value}
              onMouseDown={(event) => {
                event.preventDefault();
                selectOption(option);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={clsx(
                "cursor-pointer px-3 py-1.5",
                index === highlightedIndex && "bg-cream",
                option.value === value && "font-semibold text-primary-dark",
              )}
            >
              {splitOnMatch(option.label, query).map((segment, segmentIndex) =>
                segment.matched ? (
                  <span key={segmentIndex} className="text-primary underline">
                    {segment.text}
                  </span>
                ) : (
                  <span key={segmentIndex}>{segment.text}</span>
                ),
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
