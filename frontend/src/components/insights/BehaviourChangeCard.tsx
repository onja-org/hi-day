import { ArrowDownIcon, ArrowUpIcon, CheckCircleIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { describeBehaviourChange } from "@/lib/describeBehaviourChange";
import { formatDayRange } from "@/lib/formatDayRange";
import type { MemberHighlights } from "@/types/highlights";
import { ComparisonBars } from "./ComparisonBars";

type BehaviourChangeCardProps = {
  fromKey: string;
  checkedThrough: string | null;
  behaviourChanges: MemberHighlights["behaviourChanges"];
  ownPage: boolean;
};

/**
 * Where core work, activity or focus time moved 15% or more from the
 * member's own average over the periods just before: the change in a
 * sentence, and the two figures as bars.
 */
export function BehaviourChangeCard({ fromKey, checkedThrough, behaviourChanges, ownPage }: BehaviourChangeCardProps) {
  const { comparedWith, periodDays, checkedDays, changes } = behaviourChanges;
  const compared = comparedWith !== null && checkedThrough !== null;
  const sameDays = checkedDays < periodDays;

  return (
    <section className="flex grow flex-col gap-4 rounded-brand-sm border border-input-border bg-white p-4">
      <div>
        <h2 className="text-lg font-semibold text-primary-dark">Changes in behaviour</h2>
        {compared && (
          <p className="text-sm text-secondary">{formatDayRange(fromKey, checkedThrough)}</p>
        )}
      </div>
      {!compared && (
        <p className="text-sm text-secondary">Nothing to compare yet - days are compared once they&apos;re over.</p>
      )}
      {compared && changes.length === 0 && (
        <p className="flex items-start gap-2 rounded-brand-sm bg-volt-tint p-3 text-sm text-slate-900">
          <CheckCircleIcon size={20} aria-hidden="true" className="shrink-0 text-primary-dark" />
          No significant changes - core work, activity and focus time are close to {ownPage ? "your" : "their"} own
          average.
        </p>
      )}
      {compared && changes.length > 0 && (
        <ul className="flex flex-col divide-y divide-input-border">
          {changes.map((change) => {
            const note = describeBehaviourChange(change, {
              periodDays,
              periods: comparedWith.periods,
              ownPage,
              sameDays,
            });
            const Arrow = change.direction === "higher" ? ArrowUpIcon : ArrowDownIcon;
            return (
              <li key={change.metric} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-slate-900">{note.label}</span>
                  <span
                    className={clsx(
                      "flex items-center gap-1 rounded-brand-sm px-2 py-0.5 font-data text-sm text-slate-900",
                      change.direction === "higher" && "bg-volt-tint",
                      change.direction === "lower" && "bg-punch-tint",
                    )}
                  >
                    <Arrow size={14} weight="bold" aria-hidden="true" />
                    {note.change}
                  </span>
                </p>
                <p className="text-sm text-secondary">{note.comparison}</p>
                <ComparisonBars rows={note.rows} max={note.max} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
