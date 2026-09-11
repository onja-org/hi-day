type ActivityMeterProps = {
  activePercentage: number | null;
};

export function ActivityMeter({ activePercentage }: ActivityMeterProps) {
  if (activePercentage === null) {
    return <p className="text-xs text-slate-900/50">No activity data</p>;
  }

  const clampedValue = Math.max(0, Math.min(100, activePercentage));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1">
        <div
          className="w-full h-5 bg-primary/15 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-primary rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${clampedValue}%` }}
          />
        </div>
        <p className="text-xs text-slate-900/70">
          {activePercentage}% of 10 minutes
        </p>
      </div>
    </div>
  );
}
