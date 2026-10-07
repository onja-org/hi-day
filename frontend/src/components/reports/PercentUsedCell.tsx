type PercentUsedCellProps = {
  /** e.g. "32%"; anything else (such as "-") renders as is. */
  value: string | undefined;
};

/** A percentage with a thin bar beneath it showing the same share. */
export function PercentUsedCell({ value }: PercentUsedCellProps) {
  const percent = Number.parseFloat(value ?? "");
  if (Number.isNaN(percent)) return <>{value ?? "-"}</>;

  return (
    <div className="flex min-w-32 flex-col gap-1">
      <span>{value}</span>
      <progress
        value={percent}
        max={100}
        aria-label={`${value} used`}
        className="h-1 w-full overflow-hidden rounded-full bg-primary/10 accent-primary"
      />
    </div>
  );
}
