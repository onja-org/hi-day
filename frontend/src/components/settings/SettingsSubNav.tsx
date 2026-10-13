"use client";

import clsx from "clsx";
import { useSettingsDirty } from "@/components/SettingsDirtyProvider";

export type SettingsSubNavItem<K extends string> = {
  key: K;
  label: string;
};

type SettingsSubNavProps<K extends string> = {
  /** Names the nav for screen readers, e.g. "Activity sub-sections". */
  label: string;
  items: SettingsSubNavItem<K>[];
  active: K;
  onSelect: (key: K) => void;
};

/** The left-hand list that splits one settings tab into panels. */
export function SettingsSubNav<K extends string>({
  label,
  items,
  active,
  onSelect,
}: SettingsSubNavProps<K>) {
  // Switching panels unmounts the one on screen, so unsaved edits there
  // would vanish without a word.
  const { confirmLeave } = useSettingsDirty();

  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => {
                  if (isActive || confirmLeave()) onSelect(item.key);
                }}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "block w-full cursor-pointer rounded-brand-sm px-3 py-2 text-left text-sm font-semibold transition-colors duration-150",
                  isActive && "bg-cream text-primary",
                  !isActive && "text-slate-900 hover:bg-cream/50",
                )}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
