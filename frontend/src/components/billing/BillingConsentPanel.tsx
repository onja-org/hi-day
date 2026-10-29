"use client";

import { useState } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react";
import clsx from "clsx";

type BillingConsentPanelProps = {
  title: string;
  description: string;
  /** Figures to show above the consent, where there are any. */
  rows?: { label: string; value: string; strong?: boolean }[];
  /** A loading or error slot, for figures still being fetched. */
  children?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  /** Omitted where there is nothing to back out of — a notice, not a change. */
  onCancel?: () => void;
  busy?: boolean;
  /** False while figures are still arriving: agreeing to an unseen number. */
  confirmable?: boolean;
};

/**
 * Anything in billing that needs an admin to agree before it affects money.
 *
 * Two of them exist and they are not the same event — the Members page
 * acknowledges that the team already outgrew its seats, and the Billing page
 * authorises a seat change that has not happened yet — but the thing asked
 * of the person is identical: read a consequence, tick that you understand
 * it, confirm. Keeping one component keeps that sentence identical too; two
 * copies of "I understand my bill will change" would eventually say
 * different things.
 *
 * The confirm stays disabled until the box is ticked. A one-click dismiss
 * would be a dismissal rather than an acknowledgement, which is the whole
 * point of asking.
 */
export function BillingConsentPanel({
  title,
  description,
  rows,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  confirmable = true,
}: BillingConsentPanelProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div
      className={clsx(
        "rounded-brand-sm border-2 border-ink px-4 py-3",
        // A change being authorised is quieter than a bill already affected.
        onCancel ? "bg-cream/60" : "bg-sun",
      )}
    >
      <p className="flex items-start gap-2 text-sm text-slate-900">
        {!onCancel && (
          <WarningCircleIcon
            size={20}
            weight="bold"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-primary-dark"
          />
        )}
        <span>
          <strong className="font-bold text-primary-dark">{title}</strong>{" "}
          {description}
        </span>
      </p>

      {rows && rows.length > 0 && (
        <dl className="mt-3 flex flex-col gap-2 border-t-2 border-ink/10 pt-3 text-sm">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4"
            >
              <dt
                className={
                  row.strong
                    ? "font-bold text-primary-dark"
                    : "text-slate-900/60"
                }
              >
                {row.label}
              </dt>
              <dd className="font-data font-bold text-primary-dark">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {children}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink/10 pt-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-900">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-primary"
          />
          I understand my bill will change.
        </label>

        <div className="flex flex-wrap gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex h-10 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-white px-4 text-sm font-bold text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={!agreed || !confirmable || busy}
            className="flex h-10 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
