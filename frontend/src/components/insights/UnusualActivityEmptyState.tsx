import { SmileyIcon } from "@phosphor-icons/react";

type UnusualActivityEmptyStateProps = {
  /** True when no day in the range is over yet, so nothing could be checked. */
  notCheckedYet: boolean;
};

/** Shown when nothing in the selected range stood out. */
export function UnusualActivityEmptyState({ notCheckedYet }: UnusualActivityEmptyStateProps) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-brand-sm border border-input-border bg-white p-8 text-center">
      <SmileyIcon size={32} aria-hidden="true" className="text-primary" />
      {notCheckedYet ? (
        <>
          <p className="font-semibold text-slate-900">Nothing to check yet</p>
          <p className="text-sm text-secondary">Days are checked once they&apos;re over — come back tomorrow.</p>
        </>
      ) : (
        <>
          <p className="font-semibold text-slate-900">That&apos;s good news!</p>
          <p className="text-sm text-secondary">No unusual activity was recorded in the selected period.</p>
        </>
      )}
    </section>
  );
}
