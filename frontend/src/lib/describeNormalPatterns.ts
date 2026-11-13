import type { UnusualRule } from "@/types/unusualActivity";

/** Each rule as the explainer words it, short enough to sit in a sentence. */
const RULE_PATTERNS: Record<UnusualRule, string> = {
  consistent_activity: "activity that barely moves",
  high_activity: "activity at 95% or more",
  breakless_work: "five hours or more without a break",
  sustained_high_activity: "five hours or more above 80%",
};

/**
 * Why some patterns weren't flagged — they're how this member usually
 * works — so "nothing unusual" can't be mistaken for "nothing like it
 * happened". `null` when nothing was skipped.
 */
export function describeNormalPatterns(rules: UnusualRule[], ownPage: boolean): string | null {
  if (rules.length === 0) return null;
  const patterns = new Intl.ListFormat("en", { type: "conjunction" }).format(
    rules.map((rule) => RULE_PATTERNS[rule]),
  );
  const whose = ownPage ? "your" : "this member's";
  return `Not flagged, because it's ${whose} usual way of working (5 or more of the previous 30 days): ${patterns}.`;
}
