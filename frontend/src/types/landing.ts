/** One row of a landing-page bar illustration. `share` picks a fixed bar width. */
export type LandingStatRow = {
  label: string;
  value: string;
  share: "large" | "medium" | "small";
  tone: "sun" | "mint" | "volt";
};

/** A tab of the landing page's feature switcher. */
export type LandingFeature = {
  key: string;
  tab: string;
  title: string;
  body: string;
  points: string[];
  statsTitle: string;
  statsTotal: string;
  stats: LandingStatRow[];
};
