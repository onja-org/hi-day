import type { InputHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type CheckboxFieldProps = {
  label: ReactNode;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type">;

export function CheckboxField({
  label,
  className,
  ...inputProps
}: CheckboxFieldProps) {
  return (
    <label
      className={clsx(
        "flex cursor-pointer items-center gap-2 text-slate-900",
        className,
      )}
    >
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer accent-primary focus:ring-2 focus:ring-primary/30"
        {...inputProps}
      />
      {label}
    </label>
  );
}
