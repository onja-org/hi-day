import { StopIcon } from "@phosphor-icons/react/dist/ssr";

/** An illustration of the timer, not a live one — hidden from assistive tech. */
export function LandingTimerCard() {
  return (
    <div
      aria-hidden="true"
      className="relative flex w-85 max-w-full flex-col gap-3.5 rounded-3xl border-4 border-ink bg-ink p-5 text-chalk shadow-hard-lg shadow-volt"
    >
      <span className="font-display text-2xl font-extrabold tracking-tight">Hi Amara!</span>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm text-ink-soft">Website redesign</span>
          <span className="font-data text-4xl leading-none font-bold tracking-tight text-sun tabular-nums">
            02:10:44
          </span>
        </div>
        <span className="flex size-15 shrink-0 items-center justify-center rounded-2xl border-3 border-chalk bg-volt">
          <StopIcon size={22} weight="fill" className="text-ink" />
        </span>
      </div>
      <p className="rounded-brand-sm bg-ink-raised px-3.5 py-3 text-sm">
        Tracking time, apps and sites. Screenshots are off.
      </p>
    </div>
  );
}
