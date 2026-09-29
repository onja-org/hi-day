import type { ReactNode } from "react";
import clsx from "clsx";

type TableHeadProps = {
  children?: ReactNode;
  align?: "right";
  colSpan?: number;
  /** "compact" matches a smaller nested table, e.g. an expanded row's detail table. */
  size?: "default" | "compact";
};

/** A column header cell (`<th>`) for use inside a `TableHeader`'s `TableRow`. */
export function TableHead({
  children,
  align,
  colSpan,
  size = "default",
}: TableHeadProps) {
  return (
    <th
      colSpan={colSpan}
      className={clsx(
        "font-medium",
        size === "compact"
          ? "px-2 py-2 text-slate-900/70"
          : "px-3 py-3 text-slate-900",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}
