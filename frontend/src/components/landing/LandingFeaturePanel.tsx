import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";
import type { LandingFeature } from "@/types/landing";
import { BrandStatCard } from "../BrandStatCard";

export function LandingFeaturePanel({ feature }: { feature: LandingFeature }) {
  return (
    <div
      id="feature-panel"
      className="grid items-center gap-10 rounded-brand-lg border-4 border-ink bg-white p-6 shadow-hard-lg sm:p-12 lg:grid-cols-2"
    >
      <div className="flex flex-col gap-4.5">
        <h3 className="font-display text-4xl leading-tight font-extrabold tracking-tight">{feature.title}</h3>
        <p className="text-ink-muted">{feature.body}</p>
        <ul className="flex flex-col gap-2.5">
          {feature.points.map((point) => (
            <li key={point} className="flex items-start gap-2.5 font-semibold">
              <CheckCircleIcon size={22} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0 text-mint" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <BrandStatCard
        title={feature.statsTitle}
        totalSeconds={feature.stats.reduce((sum, row) => sum + row.seconds, 0)}
        rows={feature.stats.map((row) => ({ ...row, key: row.label }))}
      />
    </div>
  );
}
