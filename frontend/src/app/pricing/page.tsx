import type { Metadata } from "next";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingDownload } from "@/components/landing/LandingDownload";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { PricingComparison } from "@/components/pricing/PricingComparison";
import { PricingFaq } from "@/components/pricing/PricingFaq";
import { PricingHero } from "@/components/pricing/PricingHero";
import { PricingIncluded } from "@/components/pricing/PricingIncluded";
import { CLOUD_PRICE_PER_PERSON, TRIAL_DAYS } from "@/lib/pricing";

export const metadata: Metadata = {
  // Absolute, like the landing page's: this is the other half of the
  // pre-login marketing site, not an app screen.
  title: { absolute: "Pricing — Hi Day" },
  description: `One price, everything included: ${CLOUD_PRICE_PER_PERSON.annual} per person a month, with a ${TRIAL_DAYS}-day free trial. Or self-host Hi Day free forever.`,
};

export default async function Pricing() {
  // Deliberately reachable while signed in, unlike the landing page: this is
  // where the trial banner, the reminder email and the Billing section all
  // send an admin to see what the product costs. The marketing header still
  // offers "Log in" / "Get started", which reads oddly for someone already
  // signed in — worth revisiting once there is a real subscription flow to
  // send them to instead.
  return (
    <div className="min-h-full bg-chalk font-brand text-ink">
      <LandingHeader current="pricing" />
      <main>
        <PricingHero />
        <PricingIncluded />
        <LandingDownload />
        <PricingComparison />
        <PricingFaq />
        <LandingCta />
      </main>
      <LandingFooter current="pricing" />
    </div>
  );
}
