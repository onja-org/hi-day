"use client";

import clsx from "clsx";

type ActionsMenuItemProps = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Shown on hover when disabled, saying why. */
  title?: string;
  /** Styles the item as destructive. */
  isDangerous?: boolean;
};

/** One row of an Actions dropdown. Exists so the three items don't repeat
 * the same class string, and so "disabled" looks the same across them. */
export function ActionsMenuItem({
  label,
  onSelect,
  disabled,
  title,
  isDangerous,
}: ActionsMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      onClick={onSelect}
      className={clsx(
        "cursor-pointer px-3 py-2 text-left text-xs transition-colors duration-150 hover:bg-cream",
        "disabled:cursor-not-allowed disabled:text-slate-900/40 disabled:hover:bg-white",
        isDangerous ? "text-error" : "text-slate-900",
      )}
    >
      {label}
    </button>
  );
}
