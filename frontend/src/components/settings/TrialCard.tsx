import clsx from "clsx";
import { formatShortDate } from "@/lib/formatShortDate";
import { trialProgressFraction } from "@/lib/seatPricing";
import { trialBannerCopy } from "@/lib/trialBannerCopy";
import type { TrialStatus } from "@/types/billing";

type TrialCardProps = {
  trial: TrialStatus;
};

/**
 * The trial, as the thing an admin looks at first.
 *
 * The bar is there because "6 days left" answers *how long* but not *how far
 * through* — a fortnight's trial at day eight and a month's at day eight are
 * the same sentence and a different situation. The dates underneath are what
 * someone diaries; the count is what they feel.
 */
export function TrialCard({ trial }: TrialCardProps) {
  const { detail, tone } = trialBannerCopy(trial);
  const progress = trialProgressFraction(trial.trialStartedAt, trial.trialEndsAt);
  const ended = trial.isExpired;

  // Short enough to carry the display face: the pill beside it already says
  // "free trial", so the headline does not repeat it.
  const headline = ended
    ? "Trial ended"
    : `${trial.daysLeft} ${trial.daysLeft === 1 ? "day" : "days"} left`;

  return (
    <section
      className={clsx(
        "rounded-brand border-2 border-ink p-6 shadow-hard-sm",
        tone === "urgent" ? "bg-sun" : "bg-cream",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-56">
          <p className="inline-flex rounded-full bg-ink px-3 py-1 text-xs font-extrabold tracking-wide text-white uppercase">
            Free trial
          </p>
          <p className="mt-3 font-data text-4xl font-bold text-primary-dark">
            {headline}
          </p>
          <p className="mt-2 max-w-md text-sm text-slate-900/70">{detail}</p>
        </div>

        <div className="min-w-64 flex-1">
          <div
            role="progressbar"
            aria-label="Trial progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-5 w-full overflow-hidden rounded-full border-2 border-ink bg-white"
          >
            <div
              className="h-full bg-primary transition-[width] duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <dl className="mt-3 flex flex-wrap justify-between gap-4 text-xs">
            <div>
              <dt className="text-slate-900/60">Trial started</dt>
              <dd className="font-bold text-slate-900">
                {formatShortDate(trial.trialStartedAt)}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-slate-900/60">
                {ended ? "Trial ended" : "Trial ends"}
              </dt>
              <dd className="font-bold text-slate-900">
                {formatShortDate(trial.trialEndsAt)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
