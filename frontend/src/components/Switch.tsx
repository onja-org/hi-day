import { XIcon } from "@phosphor-icons/react";
import clsx from "clsx";

type SwitchProps = {
  /** The accessible name — there's no visible label beside a bare switch. */
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
};

/**
 * A bare on/off switch for a table cell or a control row, where `Toggle`'s
 * label-and-description layout would not fit. `Toggle`'s visual recipe plus
 * an ✕ in the knob while off, which `Toggle` does not draw — the two are
 * never used beside each other.
 */
export function Switch({
  label,
  checked,
  onCheckedChange,
  disabled = false,
}: SwitchProps) {
  return (
    // A label, not a span: the input itself is screen-reader-only, so the
    // label is what makes the visible switch clickable.
    <label
      className={clsx(
        "relative inline-flex h-6 w-11 shrink-0 items-center",
        !disabled && "cursor-pointer",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-sidebar-active transition-colors duration-150 peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
      <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-150 peer-checked:translate-x-5" />
      {/* A sibling of the input rather than a child of the knob, because
          `peer-checked:` only reaches siblings — so it repeats the knob's
          transform and rides along with it. */}
      <span className="pointer-events-none absolute left-0.5 flex h-5 w-5 items-center justify-center text-icon transition-all duration-150 peer-checked:translate-x-5 peer-checked:opacity-0">
        <XIcon size={10} weight="bold" aria-hidden="true" />
      </span>
    </label>
  );
}
