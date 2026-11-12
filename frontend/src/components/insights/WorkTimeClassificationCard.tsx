import { PerformanceCard } from "./PerformanceCard";

/**
 * Core vs non-core work. A placeholder until apps and websites can be
 * labelled — the Work time classification sub-task fills it in.
 */
export function WorkTimeClassificationCard() {
  return (
    <PerformanceCard title="Work time classification">
      <p className="font-semibold text-secondary">Not set up yet</p>
      <p className="text-sm text-secondary">
        Once apps and websites are labelled as core or non-core work, this shows how time splits
        between them.
      </p>
    </PerformanceCard>
  );
}
