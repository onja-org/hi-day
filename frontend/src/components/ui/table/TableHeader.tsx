import type { ReactNode } from "react";

type TableHeaderProps = {
  children: ReactNode;
};

/** Thin `<thead>` wrapper — put a `TableRow` of `TableHead` cells inside it. */
export function TableHeader({ children }: TableHeaderProps) {
  return <thead>{children}</thead>;
}
