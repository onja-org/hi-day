import type { ReactNode } from "react";

type PerformanceCardProps = {
  title: string;
  /**
   * Shown instead of the figures when there's nothing honest to show —
   * "Not enough data", "Record activity disabled" — rather than a 0 that
   * would read as a real result.
   */
  notice?: string;
  children?: ReactNode;
  /** The comparison bars; left out when there's a notice. */
  comparison?: ReactNode;
};

/** One Performance card: a title, the member's figures, and how they compare. */
export function PerformanceCard({ title, notice, children, comparison }: PerformanceCardProps) {
  return (
    <section className="flex flex-col gap-4 rounded-brand-sm border border-input-border bg-white p-4">
      <h2 className="text-sm font-semibold text-secondary">{title}</h2>
      {notice ? (
        <p className="font-semibold text-secondary">{notice}</p>
      ) : (
        <>
          <div className="flex flex-col gap-1">{children}</div>
          {comparison}
        </>
      )}
    </section>
  );
}
