import clsx from "clsx";
import type { ComparisonRow } from "@/types/insights";

type ComparisonBarsProps = {
  rows: ComparisonRow[];
  /** The value the full track stands for. */
  max: number;
};

const TRACK_HEIGHT = 8;

/**
 * The member's figure beside the team and organisation averages, as bars
 * on one shared scale. A row with no figure says so instead of drawing an
 * empty bar that would read as zero.
 */
export function ComparisonBars({ rows, max }: ComparisonBarsProps) {
  return (
    <dl className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3 text-sm">
          <dt className="w-24 shrink-0 text-secondary">{row.label}</dt>
          <dd className="min-w-12 grow overflow-hidden rounded-sm bg-sidebar">
            <svg
              viewBox={`0 0 ${max} ${TRACK_HEIGHT}`}
              width="100%"
              height={TRACK_HEIGHT}
              preserveAspectRatio="none"
              aria-hidden="true"
              className="block"
            >
              {row.span && row.span.end > row.span.start && (
                <rect
                  x={row.span.start}
                  y={0}
                  width={row.span.end - row.span.start}
                  height={TRACK_HEIGHT}
                  fill="currentColor"
                  className={clsx(row.highlight && "text-primary", !row.highlight && "text-secondary/50")}
                />
              )}
            </svg>
          </dd>
          <dd className="shrink-0 whitespace-nowrap text-right font-data text-slate-900">{row.display}</dd>
        </div>
      ))}
    </dl>
  );
}
