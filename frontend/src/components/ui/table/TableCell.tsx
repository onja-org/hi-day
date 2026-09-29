import type { ReactNode } from "react";
import clsx from "clsx";

type TableCellProps = {
  children?: ReactNode;
  align?: "right";
  colSpan?: number;
  /** "compact" matches a smaller nested table, e.g. an expanded row's detail table. */
  size?: "default" | "compact";
  className?: string;
};

/** A data cell (`<td>`) for use inside a `TableBody`'s `TableRow`. */
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
