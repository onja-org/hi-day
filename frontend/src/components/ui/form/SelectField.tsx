import type { ReactNode, SelectHTMLAttributes } from "react";
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
  compact?: boolean;
  className?: string;
  selectClassName?: string;
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">;

export function SelectField({
  label,
  hideLabel,
  hint,
  compact,
  className,
  selectClassName,
  children,
  ...selectProps
}: SelectFieldProps) {
  return (
    <label className={clsx("flex flex-col gap-1.5", className)}>
      <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>
      <select
        className={clsx(
          "h-11 rounded-md border border-input-border bg-white px-3 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50",
          compact && "text-sm",
          selectClassName,
        )}
        {...selectProps}
      >
        {children}
      </select>
      {hint && <span className="text-xs text-slate-900/60">{hint}</span>}
    </label>
  );
}
