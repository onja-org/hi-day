"use client";

import { MultiSelectDropdown } from "./MultiSelectDropdown";

type CheckboxDropdownFieldProps = {
  id: string;
  label: string;
  items: { id: string; name: string }[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  /** Singular/plural noun for the trigger text, e.g. ["team", "teams"]. */
  noun: [string, string];
  isLoading?: boolean;
};

/** A dropdown of checkboxes for picking several teams or projects. */
export function CheckboxDropdownField({
  id,
  label,
  items,
  selectedIds,
  onChange,
  noun,
  isLoading = false,
}: CheckboxDropdownFieldProps) {
  function toggle(itemId: string) {
    const next = new Set(selectedIds);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    onChange(next);
  }

  const [singular, plural] = noun;
  const triggerText = isLoading
    ? `Loading ${plural}…`
    : selectedIds.size === 0
      ? `No ${plural}`
      : `${selectedIds.size} ${selectedIds.size === 1 ? singular : plural} selected`;

  return (
    <MultiSelectDropdown
      id={id}
      label={label}
      triggerText={triggerText}
      disabled={isLoading || items.length === 0}
    >
      <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-900 hover:bg-cream">
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={() => toggle(item.id)}
                className="accent-primary"
              />
              {item.name}
            </label>
          </li>
        ))}
      </ul>
    </MultiSelectDropdown>
  );
}
