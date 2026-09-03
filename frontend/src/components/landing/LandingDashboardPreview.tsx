import { Clock, TrendUp } from "@phosphor-icons/react/dist/ssr";

const WEEKLY_BARS = [
  { day: "Mon", heightClass: "h-16" },
  { day: "Tue", heightClass: "h-24" },
  { day: "Wed", heightClass: "h-20" },
  { day: "Thu", heightClass: "h-28" },
  { day: "Fri", heightClass: "h-32" },
];

const TEAM_INITIALS = ["MR", "JT", "AK"];

export function LandingDashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg rounded-2xl border border-primary-dark/10 bg-white p-6 shadow-2xl shadow-primary-dark/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900/60">This week</p>
          <p className="text-2xl font-semibold text-primary-dark">32h 15m</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-xs font-medium text-primary-dark">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Live
        </span>
      </div>

      <div className="mt-6 flex h-32 items-end justify-between gap-3">
        {WEEKLY_BARS.map((bar) => (
          <div key={bar.day} className="flex flex-1 flex-col items-center gap-2">
            <div
              className={`w-full rounded-t-md bg-gradient-to-t from-primary to-secondary ${bar.heightClass}`}
            />
            <span className="text-xs text-slate-900/60">{bar.day}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-primary-dark/10 pt-4">
        <div className="flex -space-x-2">
          {TEAM_INITIALS.map((initials) => (
            <span
              key={initials}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-secondary text-xs font-semibold text-white"
            >
              {initials}
            </span>
          ))}
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary-dark text-xs font-semibold text-white">
            +5
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm font-medium text-primary">
          <TrendUp size={16} aria-hidden="true" />
          12% vs last week
        </div>
      </div>

      <div className="absolute -top-4 -right-4 flex items-center gap-2 rounded-xl bg-primary-dark px-4 py-2 text-white shadow-lg motion-safe:animate-float">
        <Clock size={18} aria-hidden="true" />
        <span className="text-sm font-medium">Timesheet synced</span>
      </div>
    </div>
  );
}
