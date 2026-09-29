import type { ReactNode } from "react";
import { Table } from "@/components/ui/table/Table";
import { TableHeader } from "@/components/ui/table/TableHeader";
import { TableRow } from "@/components/ui/table/TableRow";
import { TableHead } from "@/components/ui/table/TableHead";

export type ActivityTableColumn = {
  label: string;
  align?: "right";
};

type ActivityTableProps = {
  columns: ActivityTableColumn[];
  children: ReactNode;
};

export function ActivityTable({ columns, children }: ActivityTableProps) {
  return (
    <Table className="min-w-[640px]">
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.label} align={column.align}>
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      {children}
    </Table>
  );
}
