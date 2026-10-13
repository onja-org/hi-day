import clsx from "clsx";

type ToggleProps = {
  name: string;
  label: string;
  description: string;
  /** Controlled use; omit both for an uncontrolled toggle that submits
   * through the surrounding form. */
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  defaultChecked?: boolean;
  disabled?: boolean;
};

/** A labeled on/off switch, styled as a real checkbox so it submits with the parent form. */
export function Toggle({
  name,
  label,
  description,
  checked,
  onCheckedChange,
  defaultChecked,
  disabled,
}: ToggleProps) {
  return (
    <label
      className={clsx(
        "flex items-start justify-between gap-4 py-3",
        disabled && "cursor-not-allowed opacity-60",
        !disabled && "cursor-pointer",
      )}
    >
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-slate-900">{label}</span>
        <span className="text-sm text-slate-900/60">{description}</span>
      </span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          defaultChecked={checked === undefined ? defaultChecked : undefined}
          onChange={
            onCheckedChange
              ? (event) => onCheckedChange(event.target.checked)
              : undefined
          }
          disabled={disabled}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-sidebar-active transition-colors duration-150 peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
        <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-150 peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
