import type { ReactNode } from "react";
import clsx from "clsx";

type TableProps = {
  /** Extra classes for the `<table>` itself, e.g. a min-width so it scrolls horizontally on narrow screens. */
  className?: string;
  /** Skip the bordered, scrollable shell — for a table nested inside another table's cell. */
  bare?: boolean;
  children: ReactNode;
};

/**
 * The root of a table: a horizontally-scrollable, bordered shell around a
 * plain `<table>`. Compose it with `TableHeader`/`TableBody`/`TableRow`/
 * `TableHead`/`TableCell` the same way you'd write raw HTML table tags.
 */
export function Table({ className, bare, children }: TableProps) {
  const table = (
    <table className={clsx("w-full text-left text-sm", className)}>
      {children}
    </table>
  );

  if (bare) {
    return table;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-input-border">
      {table}
    </div>
  );
}
