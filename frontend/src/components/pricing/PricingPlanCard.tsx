import type { ReactNode } from "react";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr";
import clsx from "clsx";
import Link from "next/link";

type PricingPlanCardProps = {
  /** Light is the self-hosted card; ink is the highlighted Cloud one. */
  tone: "light" | "ink";
  badge: string;
  name: string;
  tagline: string;
  price: ReactNode;
  priceNote: ReactNode;
  ctaLabel: string;
  ctaHref: string;
  /** GitHub and other off-site targets open in a new tab. */
  ctaExternal?: boolean;
  features: string[];
  footnote: string;
};

export function PricingPlanCard({
  tone,
  badge,
  name,
  tagline,
  price,
  priceNote,
  ctaLabel,
  ctaHref,
  ctaExternal,
  features,
  footnote,
}: PricingPlanCardProps) {
  const ctaClassName = clsx(
    "flex h-12 items-center justify-center rounded-brand-sm border-3 border-ink px-5 font-extrabold text-ink shadow-hard-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3",
    tone === "light" && "bg-white focus-visible:outline-volt",
    tone === "ink" && "bg-sun focus-visible:outline-volt-light",
  );

  return (
    <div
      className={clsx(
        "flex flex-col gap-5 rounded-brand border-3 border-ink p-8",
        tone === "light" && "bg-white shadow-hard",
        tone === "ink" && "bg-ink text-chalk shadow-hard shadow-volt",
      )}
    >
      <div className="flex flex-col gap-2">
        <span
          className={clsx(
            "self-start rounded-full border-2 border-ink px-2.5 py-1 text-xs font-extrabold tracking-widest uppercase",
            tone === "light" && "bg-ink text-sun",
            tone === "ink" && "bg-sun text-ink",
          )}
        >
          {badge}
        </span>
        <h2 className="mt-1 font-display text-3xl font-extrabold tracking-heading">{name}</h2>
        <p className={clsx(tone === "light" && "text-ink-muted", tone === "ink" && "text-ink-soft")}>{tagline}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-display text-6xl leading-none font-extrabold tracking-heading">{price}</span>
        <span className={clsx("text-sm", tone === "light" && "text-ink-muted", tone === "ink" && "text-ink-soft")}>
          {priceNote}
        </span>
      </div>

      {ctaExternal ? (
        <a href={ctaHref} target="_blank" rel="noopener noreferrer" className={ctaClassName}>
          {ctaLabel}
        </a>
      ) : (
        <Link href={ctaHref} className={ctaClassName}>
          {ctaLabel}
        </Link>
      )}

      <ul className="flex flex-col gap-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <CheckIcon
              size={20}
              weight="bold"
              aria-hidden="true"
              className={clsx("mt-0.5 shrink-0", tone === "light" && "text-success", tone === "ink" && "text-sun")}
            />
            {feature}
          </li>
        ))}
      </ul>

      <p
        className={clsx(
          "mt-auto border-t pt-3.5 text-sm",
          tone === "light" && "border-input-border text-ink-muted",
          tone === "ink" && "border-ink-raised text-ink-soft",
        )}
      >
        {footnote}
      </p>
    </div>
  );
}
