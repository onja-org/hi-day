import type { ApiResult } from "./api";

/** What a label is attached to: an app's recorded name, or a website's host. */
export type WorkItemKind = "app" | "site";

/** "unclassified" is the absence of a label, never the same as non-core. */
export type WorkLabelChoice = "core" | "non_core" | "unclassified";

/** One app or site used in the organisation lately, with its label. */
export type WorkUsageItem = {
  kind: WorkItemKind;
  name: string;
  /** Tracked time across the organisation in the last 30 days. */
  secondsSpent: number;
  label: WorkLabelChoice;
};

export type SetWorkLabelInput = {
  kind: WorkItemKind;
  name: string;
  label: WorkLabelChoice;
};

export type GetWorkUsageResult = ApiResult<{ items: WorkUsageItem[] }>;

/** Core vs non-core time, as the Performance page's card receives it. */
export type WorkTimeClassification =
  | { status: "not_available" }
  | { status: "no_data" }
  | {
      status: "available";
      coreSeconds: number;
      nonCoreSeconds: number;
      unclassifiedSeconds: number;
    };

/** The card's three shares, whole percentages that add up to 100. */
export type WorkTimeShares = { core: number; nonCore: number; unclassified: number };
