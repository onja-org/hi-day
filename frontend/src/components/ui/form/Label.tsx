import type { LabelHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type LabelProps = {
  children: ReactNode;
  className?: string;
} & Omit<LabelHTMLAttributes<HTMLLabelElement>, "className" | "children">;

export function Label({ children, className, htmlFor, ...rest }: LabelProps) {
  const Tag = htmlFor ? "label" : "span";
  return (
    <Tag
      htmlFor={htmlFor}
      className={clsx("text-sm font-medium text-slate-900", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
