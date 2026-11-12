type TimelineLegendProps = {
  activityRecorded: boolean;
  showActivity: boolean;
};

/** The Timeline's colour key, its totals' column headings, and the
 * "Record activity disabled" notice when that's the case. */
export function TimelineLegend({ activityRecorded, showActivity }: TimelineLegendProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <ul className="flex flex-wrap gap-4 text-sm text-slate-900">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-sm bg-primary" />
          Tracked
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-sm bg-mint" />
          Manual
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-sm bg-punch" />
          Idle
        </li>
        {showActivity && !activityRecorded && (
          <li className="font-semibold text-secondary">Record activity disabled</li>
        )}
      </ul>
      <p aria-hidden="true" className="hidden font-data text-xs text-secondary md:flex">
        <span className="w-16 text-right">Tracked</span>
        <span className="w-16 text-right">Manual</span>
        <span className="w-16 text-right">Idle</span>
        {showActivity && <span className="w-16 text-right">Activity</span>}
      </p>
    </div>
  );
}
