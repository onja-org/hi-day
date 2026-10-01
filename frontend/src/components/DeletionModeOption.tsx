import type { ReactNode } from "react";
import clsx from "clsx";

type DeletionModeOptionProps = {
  title: string;
  description: string;
  checked: boolean;
  onSelect: () => void;
  /** Extra fields shown inside the card only while it is selected. */
  children?: ReactNode;
};

/** One selectable "When" card: highlighted when chosen, reveals its own fields. */
export function DeletionModeOption({
  title,
  description,
  checked,
  onSelect,
  children,
}: DeletionModeOptionProps) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-3 rounded-lg border p-3",
        checked && "border-primary bg-primary/5",
        !checked && "border-input-border",
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          name="deletion-mode"
          checked={checked}
          onChange={onSelect}
          className="mt-1"
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-primary-dark">{title}</span>
          <span className="text-xs text-slate-900/60">{description}</span>
        </span>
      </label>
      {checked && children}
    </div>
  );
}
