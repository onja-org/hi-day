export type SettingsSection = {
  key: string;
  label: string;
};

export type SettingsGroup = {
  key: string;
  label: string;
  sections: SettingsSection[];
};

/** The Settings structure, as the epic's shell ticket spells it out. */
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
 */
export function activeSettingsLocation(
  pathname: string,
): { groupKey: string; sectionKey: string } | null {
  const match = /\/settings\/([^/]+)\/([^/]+)/.exec(pathname);
  if (!match) return null;

  const group = SETTINGS_GROUPS.find((candidate) => candidate.key === match[1]);
  const section = group?.sections.find((candidate) => candidate.key === match[2]);
  return group && section
    ? { groupKey: group.key, sectionKey: section.key }
    : null;
}
