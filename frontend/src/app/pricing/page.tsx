import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingDownload } from "@/components/landing/LandingDownload";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { PricingComparison } from "@/components/pricing/PricingComparison";
import { PricingFaq } from "@/components/pricing/PricingFaq";
import { PricingHero } from "@/components/pricing/PricingHero";
import { PricingIncluded } from "@/components/pricing/PricingIncluded";
import { isAuthenticated } from "@/lib/isAuthenticated";

export const metadata: Metadata = {
  // Absolute, like the landing page's: this is the other half of the
  // pre-login marketing site, not an app screen.
  title: { absolute: "Pricing — Hi Day" },
  description:
    "One price, everything included: $3.50 per person a month, with a 14-day free trial. Or self-host Hi Day free forever.",
};

export default async function Pricing() {
  // Same pre-login rule as the landing page: the marketing shell's header
  // and footer only offer "Log in" and "Get started", so a signed-in
  // visitor belongs on their dashboard instead.
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }

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
