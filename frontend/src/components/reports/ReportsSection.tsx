import type { ReactNode } from "react";

type ReportsSectionProps = {
  title: string;
  children: ReactNode;
};

export function ReportsSection({ title, children }: ReportsSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-primary-dark">{title}</h2>
      {children}
    </section>
  );
}
