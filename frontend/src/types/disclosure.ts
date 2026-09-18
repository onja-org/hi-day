import type { ApiResult } from "./api";

export type DisclosureVersionRowStatus = "draft" | "published";

export type DisclosureDraft = {
  id: string;
  disclosureRegion: string | null;
  text: string;
  status: DisclosureVersionRowStatus;
  version: number | null;
  publishedAt: string | null;
  publishedByMembershipId: string | null;
};

export type DisclosureVersionSummary = {
  id: string;
  disclosureRegion: string | null;
  version: number;
  publishedAt: string;
  publishedByMembershipId: string | null;
};

export type GetDisclosureDraftResult =
  | { ok: true; draft: DisclosureDraft }
  | { ok: false; message: string };

export type UpdateDisclosureDraftResult = ApiResult<{ draft: DisclosureDraft }>;

export type PublishDisclosureVersionResult = ApiResult<{
  version: DisclosureDraft;
}>;

export type GetDisclosureVersionHistoryResult =
  | { ok: true; versions: DisclosureVersionSummary[] }
  | { ok: false; message: string };
