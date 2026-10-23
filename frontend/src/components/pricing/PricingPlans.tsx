"use client";

import { useState } from "react";
import clsx from "clsx";
import { GITHUB_ORG_URL } from "@/lib/marketingLinks";
import {
  BILLING_PERIODS,
  CLOUD_BILLING_NOTE,
  CLOUD_PRICE_PER_PERSON,
} from "@/lib/pricing";
import type { BillingPeriod } from "@/lib/pricing";
import { PricingPlanCard } from "./PricingPlanCard";


export function PricingPlans() {
  const [period, setPeriod] = useState<BillingPeriod>("annual");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Billing period"
          className="inline-flex gap-1 rounded-brand-sm border-3 border-ink bg-white p-1"
        >
          {BILLING_PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={period === option}
              onClick={() => setPeriod(option)}
              className={clsx(
                "h-10 cursor-pointer rounded-brand-sm px-4.5 font-extrabold capitalize focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt",
                period === option && "bg-ink text-chalk",
                period !== option && "text-ink hover:bg-sun-tint",
              )}
            >
              {option}
            </button>
          ))}
        </div>
        <span className="rounded-full border-3 border-ink bg-sun px-3.5 py-1.5 text-xs font-extrabold tracking-widest uppercase">
          Save 12% annually
        </span>
      </div>

      <div className="grid max-w-245 items-stretch gap-7 md:grid-cols-2">
        <PricingPlanCard
          tone="light"
          badge="Open source"
          name="Self-hosted"
          tagline="You run it on your own servers"
          price="Free"
          priceNote="forever, any team size"
          ctaLabel="Get the code"
          ctaHref={GITHUB_ORG_URL}
          ctaExternal
          features={[
            "All tracking features: time, activity, projects, teams, timesheets and reports",
            "Desktop apps for Windows, macOS and Linux",
            "Your data stays on your servers",
            "Community support on GitHub",
          ]}
          footnote="You look after hosting, updates and backups."
        />
        <PricingPlanCard
          tone="ink"
          badge="Everything included"
          name="Hi Day Cloud"
          tagline="We run it for you"
          price={CLOUD_PRICE_PER_PERSON[period]}
          priceNote={`per person / month, ${CLOUD_BILLING_NOTE[period]}`}
          ctaLabel="Start free trial"
          ctaHref="/signup"
          features={[
            "Everything in Self-hosted",
            "Hosting, updates and security fixes",
            "Backups",
            "Support from our team",
          ]}
          footnote="Any team size. Every feature, nothing locked."
        />
      </div>
    </div>
  );
}
