"use client";

import { WarningCircleIcon } from "@phosphor-icons/react";

/**
 * The one sentence an admin ticks before anything touches money. Exported so
 * every place that asks says it identically — two copies would drift, and
 * "I understand my bill will change" is the whole record of consent.
 */
export const BILLING_CONSENT_LABEL = "I understand my bill will change.";

type BillingConsentNoticeProps = {
  title: string;
  description: string;
  agreed: boolean;
  onAgreedChange: (agreed: boolean) => void;
  /** Figures and loading slots, between the warning and the checkbox. */
  children?: React.ReactNode;
  /** Buttons alongside the checkbox, where the consent confirms rather than gates. */
  actions?: React.ReactNode;
  /** Dropped where the surrounding panel is already the warning. */
  showIcon?: boolean;
};

/**
 * Warning, figures and checkbox — identical whether the consent confirms a
 * change on the spot (`BillingConsentPanel`) or unlocks a form's own submit
 * button (the invite forms).
 *
 * The checked state is the caller's, since only the caller knows what it
 * gates. What stays here is the wording and the shape.
 */
export function BillingConsentNotice({
  title,
  description,
  agreed,
  onAgreedChange,
  children,
  actions,
  showIcon = true,
}: BillingConsentNoticeProps) {
  return (
    <>
      <p className="flex items-start gap-2 text-sm text-slate-900">
        {showIcon && (
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

      {children}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink/10 pt-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-900">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => onAgreedChange(event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-primary"
          />
          {BILLING_CONSENT_LABEL}
        </label>

        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </>
  );
}
