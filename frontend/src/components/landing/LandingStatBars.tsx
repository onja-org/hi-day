import clsx from "clsx";
import type { LandingStatRow } from "@/types/landing";

type LandingStatBarsProps = {
  title: string;
  total: string;
  rows: LandingStatRow[];
};

/** A small, illustrative bar chart on an ink card — example numbers, not live data. */
export function LandingStatBars({ title, total, rows }: LandingStatBarsProps) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-ink p-6 text-chalk">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-extrabold tracking-widest text-ink-soft uppercase">{title}</span>
        <span className="font-data font-bold text-sun">{total}</span>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3 text-sm">
            <span className="font-semibold">{row.label}</span>
            <span className="font-data font-medium">{row.value}</span>
          </div>
          <div className="h-3.5 overflow-hidden rounded-full bg-ink-raised">
            <div
              className={clsx(
                "h-full rounded-full",
                row.share === "large" && "w-2/3",
                row.share === "medium" && "w-1/3",
                row.share === "small" && "w-1/6",
                row.tone === "sun" && "bg-sun",
                row.tone === "mint" && "bg-mint",
                row.tone === "volt" && "bg-volt-light",
              )}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
