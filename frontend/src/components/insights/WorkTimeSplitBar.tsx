import type { WorkTimeShares } from "@/types/workClassification";

const HEIGHT = 12;

type WorkTimeSplitBarProps = {
  shares: WorkTimeShares;
};

/**
 * Core, non-core and unclassified side by side in one bar. SVG rather than
 * sized divs, like ComparisonBars: proportional widths would otherwise need
 * inline styles or bracketed values.
 */
export function WorkTimeSplitBar({ shares }: WorkTimeSplitBarProps) {
  const segments = [
    { key: "core", value: shares.core, className: "text-primary" },
    { key: "non-core", value: shares.nonCore, className: "text-secondary/50" },
    { key: "unclassified", value: shares.unclassified, className: "text-primary-dark/10" },
  ];
  let x = 0;

  return (
    <svg
      viewBox={`0 0 100 ${HEIGHT}`}
      width="100%"
      height={HEIGHT}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="block overflow-hidden rounded-sm"
    >
      {segments.map((segment) => {
        const rect = (
          <rect
            key={segment.key}
            x={x}
            y={0}
            width={segment.value}
            height={HEIGHT}
            fill="currentColor"
            className={segment.className}
          />
        );
        x += segment.value;
        return rect;
      })}
    </svg>
  );
}
