import { CLOUD_PRICE_PER_PERSON, TRIAL_PROMISE } from "@/lib/pricing";
import { LandingButtonLink } from "./LandingButtonLink";

export function LandingPricingTeaser() {
  return (
    <section id="pricing" className="border-b-3 border-ink bg-sun-tint">
      <div className="mx-auto flex max-w-300 flex-wrap items-center justify-between gap-8 px-6 py-18">
        <div className="flex max-w-155 flex-col gap-3">
          <span className="text-xs font-extrabold tracking-widest text-volt uppercase">Hi Day Cloud</span>
          <h2 className="font-display text-heading font-extrabold tracking-heading">
            Or let us run it for you.
          </h2>
          <p className="text-lg text-ink-muted">
            {CLOUD_PRICE_PER_PERSON.annual} per person a month, everything included: hosting,
            updates, backups and support. {TRIAL_PROMISE}
          </p>
        </div>
        <div className="flex flex-wrap gap-3.5">
          <LandingButtonLink href="/signup">Start free trial</LandingButtonLink>
          <LandingButtonLink href="/pricing" tone="white">
            See pricing
          </LandingButtonLink>
        </div>
      </div>
    </section>
  );
}
