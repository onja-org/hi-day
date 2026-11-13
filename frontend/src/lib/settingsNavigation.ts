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

/** The full list. What an installation shows is `visibleSettingsGroups`. */
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
      { key: "work-time-classification", label: "Work time classification" },
    ],
  },
];

/** One filter for the sidebar, the cards and the section header. The pages
 * still 404 separately — omitting a link is not refusing a route. */
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
 * The group and section a path is showing, or null when it is not one. Takes
 * the billing flag because a billing path on a self-hosted install is not a
 * settings section at all.
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
