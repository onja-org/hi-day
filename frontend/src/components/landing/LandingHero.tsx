import { LandingButtonLink } from "./LandingButtonLink";
import { LandingTimerCard } from "./LandingTimerCard";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden border-b-3 border-ink">
      <div className="mx-auto grid max-w-300 items-center gap-14 px-6 pt-18 pb-22 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <span className="self-start rounded-full border-3 border-ink bg-mint-tint px-3.5 py-1.5 text-xs font-extrabold tracking-widest uppercase">
            Balanced time tracking
          </span>
          <h1 className="font-display text-display font-extrabold tracking-tighter">
            Time tracking that says hi, not gotcha.
          </h1>
          <p className="max-w-xl text-lg text-ink-muted">
            Track time, projects and activity in the desktop app and on the web. Your team sees exactly
            what managers see, so nobody wonders what&apos;s being counted.
          </p>
          <div className="flex flex-wrap gap-3.5">
            <LandingButtonLink href="/signup">Get started</LandingButtonLink>
            <LandingButtonLink href="/pricing#download" tone="white">
              Get the desktop app
            </LandingButtonLink>
          </div>
          <p className="text-sm text-ink-muted">
            Hi Day Cloud from $3.50 per person / month, or{" "}
            <a
              href="#open-source"
              className="underline underline-offset-4 hover:text-volt focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt"
            >
              self-host the open-source version free
            </a>
            .
          </p>
        </div>

        <div className="relative flex min-h-110 items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute top-2.5 -right-10 size-95 rounded-full border-4 border-ink bg-sun"
          />
          <div
            aria-hidden="true"
            className="absolute bottom-5 left-0 size-30 rounded-full border-4 border-ink bg-bubble"
          />
          <div
            aria-hidden="true"
            className="absolute top-7.5 left-10 h-11.25 w-22.5 rounded-t-full border-4 border-b-0 border-ink bg-mint"
          />
          <LandingTimerCard />
        </div>
      </div>
    </section>
  );
}
