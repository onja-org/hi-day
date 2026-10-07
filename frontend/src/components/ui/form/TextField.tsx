import type { InputHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { Label } from "@/components/ui/form/Label";

type TextFieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  /** Shown under the input, replacing the hint — what is wrong with *this*
   * field, so the message sits where the fix is made. */
  error?: ReactNode;
  /** Marks the input as wrong without a message of its own — for a problem
   * that spans two fields and is spelled out under the second of them. */
  invalid?: boolean;
  compact?: boolean;
  className?: string;
  inputClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

export function TextField({
  label,
  hint,
  error,
  invalid,
  compact,
  className,
  inputClassName,
  ...inputProps
}: TextFieldProps) {
  return (
    <label className={clsx("flex flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      <input
        aria-invalid={error || invalid ? true : undefined}
        className={clsx(
          "h-11 rounded-md border bg-white px-3 text-slate-900 transition-all duration-150 focus:outline-none focus:ring-2 disabled:opacity-50",
          (error || invalid) && "border-error focus:border-error focus:ring-error/30",
          !error && !invalid && "border-input-border focus:border-primary focus:ring-primary/30",
          compact && "text-sm",
          inputClassName,
        )}
        {...inputProps}
      />
      {error && <span className="text-xs text-error">{error}</span>}
      {!error && hint && <span className="text-xs text-slate-900/60">{hint}</span>}
    </label>
  );
}
