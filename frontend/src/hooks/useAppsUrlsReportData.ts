import { useQueries } from "@tanstack/react-query";
import { APP_ACTIVITY_DAY_QUERY_KEY } from "@/hooks/useAppActivityDay";
import { URL_ACTIVITY_DAY_QUERY_KEY } from "@/hooks/useUrlActivityDay";
import { getAppActivityDay } from "@/lib/getAppActivityDay";
import { getUrlActivityDay } from "@/lib/getUrlActivityDay";

import type { AppsUrlsMember, AppsUrlsMemberDay } from "@/types/appsUrlsReport";

type DayResult<T> = { ok: true; day: T } | { ok: false; message: string };

type MemberDate = { member: AppsUrlsMember; date: string };

/** One request per member per day, sharing the Activity tabs' cache keys. `data` stays undefined until every one has loaded. */
function useDayQueries<T>(
  pairs: MemberDate[],
  enabled: boolean,
  queryKey: (pair: MemberDate) => unknown[],
  fetchDay: (pair: MemberDate) => Promise<DayResult<T>>,
) {
  return useQueries({
    queries: pairs.map((pair) => ({
      queryKey: queryKey(pair),
      queryFn: async (): Promise<T> => {
        const result = await fetchDay(pair);
        if (!result.ok) throw new Error(result.message);
        return result.day;
      },
      enabled,
    })),
    combine: (results) => ({
      data: results.every((result) => result.data)
        ? results.map((result, index): AppsUrlsMemberDay<T> => ({ member: pairs[index].member, day: result.data as T }))
        : undefined,
      isLoading: results.some((result) => result.isLoading),
      error: results.find((result) => result.error)?.error ?? null,
    }),
  });
}

/**
 * The given members' app and website activity for each given day. The
 * activity API answers one member and day at a time, so this fans out a
 * request per member per day for each of apps and URLs.
 */
export function useAppsUrlsReportData(
  organisationId: string,
  dateKeys: string[],
  members: AppsUrlsMember[],
  enabled: boolean,
) {
  const pairs = members.flatMap((member) => dateKeys.map((date) => ({ member, date })));
  const apps = useDayQueries(
    pairs,
    enabled,
    ({ member, date }) => APP_ACTIVITY_DAY_QUERY_KEY(organisationId, { date, membershipId: member.membershipId }),
    ({ member, date }) => getAppActivityDay(organisationId, { date, membershipId: member.membershipId }),
  );
  const urls = useDayQueries(
    pairs,
    enabled,
    ({ member, date }) => URL_ACTIVITY_DAY_QUERY_KEY(organisationId, { date, membershipId: member.membershipId }),
    ({ member, date }) => getUrlActivityDay(organisationId, { date, membershipId: member.membershipId }),
  );

  return {
    appDays: apps.data,
    urlDays: urls.data,
    isLoading: apps.isLoading || urls.isLoading,
    error: apps.error ?? urls.error,
  };
}
