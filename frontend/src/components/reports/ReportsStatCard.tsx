import type { Icon } from "@phosphor-icons/react";

type ReportsStatCardProps = {
  label: string;
  /** Pre-formatted, e.g. "27:08:37" or "$0.00". Pass "--" when there's no data. */
  value: string;
  icon: Icon;
};

export function ReportsStatCard({ label, value, icon: StatIcon }: ReportsStatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-input-border bg-white p-4">
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <StatIcon size={24} />
      </span>
      <div className="flex flex-col">
        <span className="text-sm text-slate-900/70">{label}</span>
        <span className="text-2xl font-semibold text-primary-dark">{value}</span>
      </div>
    </div>
  );
}
