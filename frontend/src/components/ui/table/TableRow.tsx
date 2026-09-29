import type { ReactNode } from "react";

type TableRowProps = {
  children: ReactNode;
};

/** A single `<tr>`, styled consistently whether it's a header or body row. */
export function TableRow({ children }: TableRowProps) {
  return (
    <tr className="border-b border-input-border">{children}</tr>
  );
}
