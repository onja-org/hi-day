export type SettingsSection = {
  key: string;
  label: string;
};

export type SettingsGroup = {
  key: string;
  label: string;
  sections: SettingsSection[];
};

/** The group that exists only where this installation bills somebody. */
export const BILLING_GROUP_KEY = "billing";

/**
 * The Settings structure, as the epic's shell ticket spells it out.
 *
 * The full list, including Billing. What a given installation actually
 * shows is `visibleSettingsGroups`, because whether billing exists is only
 * known at runtime — see `useBillingEnabled`.
 */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    key: "organization",
    label: "Organization",
    sections: [
      { key: "company-information", label: "Company information" },
      { key: "security", label: "Security & log in" },
    ],
  },
  {
    key: "members",
    label: "Members",
    sections: [{ key: "work-time-limits", label: "Work time limits" }],
  },
  {
    key: "projects",
    label: "Projects",
    sections: [{ key: "projects", label: "Projects" }],
  },
  {
    key: "billing",
    label: "Billing",
    sections: [
      { key: "subscription", label: "Subscription" },
      { key: "info", label: "Billing info" },
    ],
  },
  {
    key: "tracking",
    label: "Activity & tracking",
    sections: [
      { key: "activity", label: "Activity" },
      { key: "timesheets", label: "Timesheets" },
      { key: "time", label: "Time & tracking" },
      { key: "screenshots", label: "Screenshots" },
    ],
  },
];

/**
 * The Settings groups this installation actually has.
 *
 * One filter, read by the sidebar, the settings cards and the section
 * header alike, so a self-hosted install has no Billing entry in any of
 * them without any of them knowing why.
 *
 * The pages themselves still 404 independently: a nav that omits a link is
 * not a route that refuses one, and a bookmarked URL must not get through.
 */
export function visibleSettingsGroups(billingEnabled: boolean): SettingsGroup[] {
  if (billingEnabled) return SETTINGS_GROUPS;
  return SETTINGS_GROUPS.filter((group) => group.key !== BILLING_GROUP_KEY);
}

export function settingsHref(
  organisationId: string | number,
  groupKey: string,
  sectionKey: string,
): string {
  return `/organisations/${organisationId}/settings/${groupKey}/${sectionKey}`;
}

/**
 * The group and section a path is showing, or null when it is not a settings
 * section — so the nav can mark one entry active without string-matching at
 * each call site.
 *
 * Takes the billing flag because a billing path on a self-hosted install is
 * not a settings section at all: nothing should highlight for it, and the
 * header should render no section tabs above a page that is about to 404.
 */
export function activeSettingsLocation(
  pathname: string,
  billingEnabled: boolean,
): { groupKey: string; sectionKey: string } | null {
  const match = /\/settings\/([^/]+)\/([^/]+)/.exec(pathname);
  if (!match) return null;

  const groups = visibleSettingsGroups(billingEnabled);
  const group = groups.find((candidate) => candidate.key === match[1]);
  const section = group?.sections.find((candidate) => candidate.key === match[2]);
  return group && section
    ? { groupKey: group.key, sectionKey: section.key }
    : null;
}
