import { PricingPlans } from "./PricingPlans";
import { PricingLargeTeam } from "./PricingLargeTeam";

export function PricingHero() {
  return (
    <section className="border-b-3 border-ink">
      <div className="mx-auto flex max-w-300 flex-col gap-8 px-6 pt-18 pb-20">
        <div className="flex flex-col gap-5">
          <span className="self-start rounded-full border-3 border-ink bg-mint-tint px-3.5 py-1.5 text-xs font-extrabold tracking-widest uppercase">
            Pricing
          </span>
          <h1 className="max-w-215 font-display text-heading font-extrabold tracking-heading">
            One price. Everything included.
          </h1>
          <p className="max-w-160 text-lg text-ink-muted">
            Self-host Hi Day free forever, or let us run it for one simple per-person price. Every
            feature, for every team. No tiers to compare, no add-ons, no hidden fees.
          </p>
        </div>
        <PricingPlans />
        <PricingLargeTeam />
      </div>
    </section>
  );
}
