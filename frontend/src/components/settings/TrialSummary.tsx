import { formatShortDate } from "@/lib/formatShortDate";
import { trialBannerCopy } from "@/lib/trialBannerCopy";
import type { TrialStatus } from "@/types/billing";

type TrialSummaryProps = {
  trial: TrialStatus;
};

/** The trial in detail: the same headline the banner shows, plus its dates. */
export function TrialSummary({ trial }: TrialSummaryProps) {
  const { headline, detail } = trialBannerCopy(trial);

  return (
    <>
      <p className="mt-1 text-sm text-slate-900/60">{detail}</p>
      <p className="mt-4 font-data text-2xl font-bold text-primary-dark">
        {headline}
      </p>
      <dl className="mt-4 flex flex-wrap gap-8 text-sm">
        <div>
          <dt className="text-slate-900/60">Trial started</dt>
          <dd className="text-slate-900">{formatShortDate(trial.trialStartedAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-900/60">
            {trial.isExpired ? "Trial ended" : "Trial ends"}
          </dt>
          <dd className="text-slate-900">{formatShortDate(trial.trialEndsAt)}</dd>
        </div>
      </dl>
    </>
  );
}
