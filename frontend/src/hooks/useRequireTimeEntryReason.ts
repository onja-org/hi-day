import { useCurrentOrganisation } from "./useCurrentOrganisation";

/**
 * Whether a Reason has to be given when time is added, edited or deleted —
 * the organisation's Require reason setting.
 *
 * Defaults to `true` while the setting is still loading: demanding a reason
 * that turns out to be optional is recoverable, silently accepting a blank
 * one the organisation requires is not.
 */
export function useRequireTimeEntryReason(): boolean {
  const organisationQuery = useCurrentOrganisation();
  return organisationQuery.data?.timesheetRequireReason ?? true;
}
