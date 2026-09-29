import type { ReactNode } from "react";

type TableBodyProps = {
  children: ReactNode;
};

/**
 * `<tbody>` wrapper. `[&_tr:last-child]:border-0` drops the border off the
 * last row within this body specifically, so a header row's own border
 * (in `TableHeader`, outside any `TableBody`) is never affected — no need
 * for every `TableRow` to guess whether it's the table's last row overall.
 */
export function TableBody({ children }: TableBodyProps) {
  return <tbody className="[&_tr:last-child]:border-0">{children}</tbody>;
}
