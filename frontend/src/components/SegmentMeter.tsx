import clsx from "clsx";

const SEGMENTS = 10;

type SegmentMeterProps = {
  /** 0–1, clamped. */
  fraction: number;
  label: string;
};

/**
 * Deciles rather than a sized bar: a 0–100 fill width needs an inline style
 * or a bracketed value, both of which this frontend forbids (see
 * frontend/CLAUDE.md). Keeps the meter inside the brand palette too.
 */
export function SegmentMeter({ fraction, label }: SegmentMeterProps) {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * SEGMENTS);

  return (
    <span
      className="inline-flex h-1.5 w-20 gap-px overflow-hidden rounded-full"
      role="img"
      aria-label={label}
    >
      {Array.from({ length: SEGMENTS }, (_, index) => (
        <span
          key={index}
          className={clsx(
            "flex-1",
            index < filled ? "bg-primary" : "bg-primary/15",
          )}
        />
      ))}
    </span>
  );
}
