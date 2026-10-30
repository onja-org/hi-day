"use client";

type BillingDetailRowProps = {
  title: string;
  /** The one line under the title saying what the value means. */
  hint: string;
  /** The value itself — text, or anything that reads as one (a bar, an icon). */
  children: React.ReactNode;
  /** A button, or a status that is not a control. Omitted where neither applies. */
  action?: React.ReactNode;
};

/**
 * One line of Billing details: what it is, what it says, and what can be
 * done about it.
 *
 * A row rather than a card per fact — the four are read together, and four
 * bordered boxes made that a grid to scan instead of a list to read down.
 * Wraps on a narrow screen so a long address keeps its own line.
 */
export function BillingDetailRow({
  title,
  hint,
  children,
  action,
}: BillingDetailRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-primary-dark">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-900/60">{hint}</p>
      </div>

      <div className="min-w-0 flex-1 font-data text-sm font-bold break-all text-primary-dark">
        {children}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
