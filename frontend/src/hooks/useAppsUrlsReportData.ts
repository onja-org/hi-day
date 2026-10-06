import { useQueries } from "@tanstack/react-query";
import { APP_ACTIVITY_DAY_QUERY_KEY } from "@/hooks/useAppActivityDay";
import { URL_ACTIVITY_DAY_QUERY_KEY } from "@/hooks/useUrlActivityDay";
import { getAppActivityDay } from "@/lib/getAppActivityDay";
import { getUrlActivityDay } from "@/lib/getUrlActivityDay";

type DayResult<T> = { ok: true; day: T } | { ok: false; message: string };

/** One request per day, sharing the Activity tabs' cache keys. `data` stays undefined until every day has loaded. */
function useDayQueries<T>(
  dateKeys: string[],
  enabled: boolean,
  queryKey: (date: string) => unknown[],
  fetchDay: (date: string) => Promise<DayResult<T>>,
) {
  return useQueries({
    queries: dateKeys.map((date) => ({
      queryKey: queryKey(date),
      queryFn: async (): Promise<T> => {
        const result = await fetchDay(date);
        if (!result.ok) throw new Error(result.message);
        return result.day;
      },
      enabled,
    })),
    combine: (results) => ({
      data: results.every((result) => result.data) ? results.map((result) => result.data as T) : undefined,
      isLoading: results.some((result) => result.isLoading),
      error: results.find((result) => result.error)?.error ?? null,
    }),
  });
}

/**
 * The viewer's own app and website activity for each given day. The
 * activity API answers one day at a time, so this fans out a request per
 * day for each of apps and URLs.
 */
export function useAppsUrlsReportData(organisationId: string, dateKeys: string[], enabled: boolean) {
  const apps = useDayQueries(
    dateKeys,
    enabled,
    (date) => APP_ACTIVITY_DAY_QUERY_KEY(organisationId, { date }),
    (date) => getAppActivityDay(organisationId, { date }),
  );
  const urls = useDayQueries(
    dateKeys,
    enabled,
    (date) => URL_ACTIVITY_DAY_QUERY_KEY(organisationId, { date }),
    (date) => getUrlActivityDay(organisationId, { date }),
  );

  return {
    appDays: apps.data,
    urlDays: urls.data,
    isLoading: apps.isLoading || urls.isLoading,
    error: apps.error ?? urls.error,
  };
}
