import type { ReactNode, SelectHTMLAttributes } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { Label } from "@/components/ui/form/Label";

type SelectFieldProps = {
  label: ReactNode;
  /** Keeps the label accessible to screen readers but visually hidden —
   * for a per-row control in a table where the column header already
   * gives sighted users the same context, so a repeated visible label on
   * every row would just be noise. */
  hideLabel?: boolean;
  hint?: ReactNode;
  /** Marks the control as wrong; the message sits with whatever owns it. */
  invalid?: boolean;
  compact?: boolean;
  className?: string;
  selectClassName?: string;
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">;

export function SelectField({
  label,
  hideLabel,
  hint,
  invalid,
  compact,
  className,
  selectClassName,
  children,
  ...selectProps
}: SelectFieldProps) {
  // The caret is a sibling, so the control's disabled styling misses it.
  const { disabled } = selectProps;

  return (
    <label className={clsx("flex flex-col gap-1.5", className)}>
      <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>
      {/* Drawn here because a native caret sits at a fixed offset from the
          border that padding cannot move. Laid out as PasswordInput's. */}
      <div className="relative flex items-center">
        <select
          aria-invalid={invalid ? true : undefined}
          className={clsx(
            "h-11 w-full appearance-none rounded-md border bg-white pl-3 pr-10 text-slate-900 focus:outline-none focus:ring-2 disabled:opacity-50",
            invalid && "border-error focus:border-error focus:ring-error/30",
            !invalid && "border-input-border focus:border-primary focus:ring-primary/30",
            compact && "text-sm",
            selectClassName,
          )}
          {...selectProps}
        >
          {children}
        </select>
        <CaretDownIcon
          size={16}
          weight="bold"
          aria-hidden="true"
          className={clsx(
            "pointer-events-none absolute right-3 text-icon",
            disabled && "opacity-50",
          )}
        />
      </div>
      {hint && <span className="text-xs text-slate-900/60">{hint}</span>}
    </label>
  );
}
