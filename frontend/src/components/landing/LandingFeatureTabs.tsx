"use client";

import { useState } from "react";
import clsx from "clsx";
import type { LandingFeature } from "@/types/landing";
import { LandingFeaturePanel } from "./LandingFeaturePanel";

/** Pill buttons that swap the panel below — plain toggle buttons
 * (aria-pressed) rather than an ARIA tablist, so keyboard use is just Tab
 * and Enter like any other button. */
export function LandingFeatureTabs({ features }: { features: LandingFeature[] }) {
  const [activeKey, setActiveKey] = useState(features[0].key);
  const active = features.find((feature) => feature.key === activeKey) ?? features[0];

  return (
    <div className="flex flex-col gap-10">
      <div role="group" aria-label="Features" className="flex flex-wrap gap-2.5">
        {features.map((feature) => {
          const selected = feature.key === active.key;
          return (
            <button
              key={feature.key}
              type="button"
              aria-pressed={selected}
              aria-controls="feature-panel"
              onClick={() => setActiveKey(feature.key)}
              className={clsx(
                "h-12 cursor-pointer rounded-full border-3 border-ink px-5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-volt",
                selected && "bg-ink font-extrabold text-chalk",
                !selected && "bg-white font-bold text-ink hover:bg-sun-tint",
              )}
            >
              {feature.tab}
            </button>
          );
        })}
      </div>
      <LandingFeaturePanel feature={active} />
    </div>
  );
}
