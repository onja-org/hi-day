import type { BrandStatRow } from "./brandStat";

/** A tab of the landing page's feature switcher. */
export type LandingFeature = {
  key: string;
  tab: string;
  title: string;
  body: string;
  points: string[];
  statsTitle: string;
  /** Example rows for the tab's BrandStatCard; the card total is their sum. */
  stats: Omit<BrandStatRow, "key">[];
};
