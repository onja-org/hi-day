import type { InputHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { Label } from "@/components/ui/form/Label";

type TextFieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  compact?: boolean;
  className?: string;
  inputClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

export function TextField({
  label,
  hint,
  compact,
  className,
  inputClassName,
  ...inputProps
}: TextFieldProps) {
  return (
    <label className={clsx("flex flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      <input
        className={clsx(
          "h-11 rounded-md border border-input-border bg-white px-3 text-slate-900 transition-all duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50",
          compact && "text-sm",
          inputClassName,
        )}
        {...inputProps}
      />
      {hint && <span className="text-xs text-slate-900/60">{hint}</span>}
    </label>
  );
}
