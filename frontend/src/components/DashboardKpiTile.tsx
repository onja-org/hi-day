import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { fractionClass } from "@/lib/fractionClass";

type DashboardKpiTileProps = {
  label: string;
  value: string;
  /** Pre-formatted delta, e.g. "2:07:31" or "1%" — omit to show no comparison. */
  deltaLabel?: string;
  /** Signed magnitude behind `deltaLabel` — only its sign matters, drives the arrow direction and color. */
  delta?: number;
  /** Optional trend points (e.g. one per day this week), oldest first. */
  sparkline?: number[];
  /** Small caption under the value, e.g. "of 8h target". */
  subLabel?: string;
  /** A small circular indicator before the label, e.g. "bg-primary" — purely
   * decorative, omit for the plain (dashboard) tile look. */
  dotClassName?: string;
  /**
   * 0-1 progress toward some target (e.g. hours worked vs. daily target) —
   * rendered as a thin track. Snapped to `fractionClass`'s 13-step scale, so
   * it's a glance-level indicator, not a pixel-exact rendering of the value
   * beside it — the same tradeoff this app already accepts for every other
   * proportional bar (e.g. `TimesheetProjectBreakdown`'s per-project bars).
   */
  progressRatio?: number;
};

const SPARKLINE_WIDTH = 64;
const SPARKLINE_HEIGHT = 24;

export function DashboardKpiTile({
  label,
  value,
  deltaLabel,
  delta,
  sparkline,
  subLabel,
  dotClassName,
  progressRatio,
}: DashboardKpiTileProps) {
  const hasDelta = deltaLabel !== undefined && delta !== undefined;
  const isUp = hasDelta && delta! > 0;
  const isDown = hasDelta && delta! < 0;

  const points =
    sparkline && sparkline.length > 1
      ? toPolylinePoints(sparkline)
      : undefined;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-input-border bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-900/70 uppercase">
          {dotClassName && (
            <span aria-hidden="true" className={clsx("h-1.5 w-1.5 rounded-full", dotClassName)} />
          )}
          {label}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold tabular-nums text-primary-dark">
            {value}
          </span>
          {subLabel && (
            <span className="text-xs text-slate-900/60">{subLabel}</span>
          )}
          {hasDelta && (
            <span
              className={clsx(
                "flex items-center gap-1 text-xs font-medium tabular-nums",
                isUp && "text-success",
                isDown && "text-error",
                !isUp && !isDown && "text-slate-900/70",
              )}
            >
              {isUp && <CaretUpIcon size={12} weight="fill" aria-hidden="true" />}
              {isDown && (
                <CaretDownIcon size={12} weight="fill" aria-hidden="true" />
              )}
              {deltaLabel}
            </span>
          )}
        </div>

        {points && (
          <svg
            viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
            width={SPARKLINE_WIDTH}
            height={SPARKLINE_HEIGHT}
            aria-hidden="true"
            className="shrink-0 text-primary"
          >
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {progressRatio !== undefined && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-sidebar">
          <div className={clsx("h-full rounded-full bg-primary", fractionClass("w", progressRatio))} />
        </div>
      )}
    </div>
  );
}

function toPolylinePoints(values: number[]): string {
  const max = Math.max(...values, 1);
  const step = SPARKLINE_WIDTH / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = SPARKLINE_HEIGHT - (value / max) * SPARKLINE_HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
