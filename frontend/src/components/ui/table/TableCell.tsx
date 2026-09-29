import type { ReactNode } from "react";
import clsx from "clsx";

type TableCellProps = {
  children?: ReactNode;
  align?: "right";
  colSpan?: number;
  size?: "default" | "compact";
  className?: string;
};

export function TableCell({
  children,
  align,
  colSpan,
  size = "default",
  className,
}: TableCellProps) {
  return (
    <td
      colSpan={colSpan}
      className={clsx(
        size === "compact" ? "px-2 py-2" : "px-3 py-3",
        "text-slate-900",
        align === "right" && "text-right tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}
