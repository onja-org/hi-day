import type { ReactNode } from "react";
import clsx from "clsx";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/form/Label";

type PasswordFieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  name: string;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
  pattern?: string;
  title?: string;
  disabled?: boolean;
};

export function PasswordField({
  label,
  hint,
  className,
  ...passwordProps
}: PasswordFieldProps) {
  return (
    <label className={clsx("flex flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      <PasswordInput {...passwordProps} />
      {hint && <span className="text-xs text-slate-900/60">{hint}</span>}
    </label>
  );
}
