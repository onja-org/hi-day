import { SALES_EMAIL } from "@/lib/marketingLinks";

export function PricingLargeTeam() {
  return (
    <div className="flex max-w-245 flex-wrap items-center justify-between gap-4 rounded-brand border-3 border-ink bg-white px-7 py-6 shadow-hard-sm">
      <div className="flex max-w-105 flex-col gap-1">
        <h2 className="font-display text-2xl font-extrabold tracking-heading">More than 50 people?</h2>
        <p className="text-ink-muted">
          Same features, same price per person. Get in touch and we&apos;ll help you get set up.
        </p>
      </div>
      <a
        href={`mailto:${SALES_EMAIL}`}
        className="flex h-12 items-center justify-center rounded-brand-sm border-3 border-ink bg-white px-5 font-extrabold text-ink shadow-hard-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt"
      >
        Talk to us
      </a>
    </div>
  );
}
