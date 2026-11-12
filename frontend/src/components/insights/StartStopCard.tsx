import { buildComparisonRows } from "@/lib/buildComparisonRows";
import { formatMinuteOfDay } from "@/lib/formatMinuteOfDay";
import type { PerformanceCardInput } from "@/types/insights";
import { ComparisonBars } from "./ComparisonBars";
import { PerformanceCard } from "./PerformanceCard";

const MINUTES_PER_DAY = 24 * 60;

type Span = { start: number; stop: number };

/** When the member usually starts and stops, drawn as a span across the day. */
export function StartStopCard({ report, memberLabel }: PerformanceCardInput) {
  const startStop = report.member.startStop;
  if (!startStop) {
    return <PerformanceCard title="Start / stop times" notice="Not enough data" />;
  }

  const spanOf = (averages: { startMinute: number | null; stopMinute: number | null }) =>
    averages.startMinute === null || averages.stopMinute === null
      ? null
      : { start: averages.startMinute, stop: averages.stopMinute };
  const team = report.averages.team;
  const rows = buildComparisonRows<Span>({
    memberLabel,
    member: { start: startStop.startMinute, stop: startStop.stopMinute },
    team: team === null ? undefined : spanOf(team),
    organisation: spanOf(report.averages.organisation),
    toSpan: (span) => ({ start: span.start, end: span.stop }),
    format: (span) => `${formatMinuteOfDay(span.start)}–${formatMinuteOfDay(span.stop)}`,
  });

  return (
    <PerformanceCard
      title="Start / stop times"
      comparison={<ComparisonBars rows={rows} max={MINUTES_PER_DAY} />}
    >
      <p className="font-data text-2xl text-slate-900">
        {formatMinuteOfDay(startStop.startMinute)} – {formatMinuteOfDay(startStop.stopMinute)}
      </p>
      <p className="text-sm text-secondary">
        Usual start and stop over {startStop.days} worked {startStop.days === 1 ? "day" : "days"}
      </p>
    </PerformanceCard>
  );
}
