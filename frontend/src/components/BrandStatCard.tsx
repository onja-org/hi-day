import clsx from "clsx";
import { fractionClass } from "@/lib/fractionClass";
import { formatHoursMinutes } from "@/lib/formatHoursMinutes";
import type { BrandStatRow } from "@/types/brandStat";

type BrandStatCardProps = {
  title: string;
  totalSeconds: number;
  rows: BrandStatRow[];
  /** Shown in place of the bars when there are no rows. */
  emptyText?: string;
};

/**
 * The ink "time at a glance" card. The landing page's #features renders
 * this same component with example rows, so what it shows there is what
 * the app shows here.
 */
export function BrandStatCard({ title, totalSeconds, rows, emptyText }: BrandStatCardProps) {
  const maxSeconds = Math.max(...rows.map((row) => row.seconds), 1);

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-ink p-6 text-chalk">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-extrabold tracking-widest text-ink-soft uppercase">{title}</span>
        <span className="font-data font-bold text-sun">{formatHoursMinutes(totalSeconds)}</span>
      </div>
      {rows.length === 0 && emptyText && <p className="text-sm text-ink-soft">{emptyText}</p>}
      {rows.map((row, index) => (
        <div key={row.key} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate font-semibold">{row.label}</span>
            <span className="font-data font-medium">{formatHoursMinutes(row.seconds)}</span>
          </div>
          <div className="h-3.5 overflow-hidden rounded-full bg-ink-raised">
            <div
              className={clsx(
                "h-full rounded-full",
                fractionClass("w", row.seconds / maxSeconds),
                index % 3 === 0 && "bg-sun",
                index % 3 === 1 && "bg-mint",
                index % 3 === 2 && "bg-volt-light",
              )}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
