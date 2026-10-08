import type { ReactNode, TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import { Label } from "@/components/ui/form/Label";

type TextareaFieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

export function TextareaField({
  label,
  hint,
  className,
  ...textareaProps
}: TextareaFieldProps) {
  return (
    <label className={clsx("flex flex-col gap-1.5", className)}>
      <Label>{label}</Label>
      <textarea
        className="rounded-brand-sm border-2 border-ink bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        {...textareaProps}
      />
      {hint && <span className="text-xs text-slate-900/60">{hint}</span>}
    </label>
  );
}
