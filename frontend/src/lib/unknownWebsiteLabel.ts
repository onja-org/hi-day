const BROWSER_NAMES: Record<string, string> = {
  chrome: "Chrome",
  edge: "Edge",
  brave: "Brave",
  opera: "Opera",
  vivaldi: "Vivaldi",
  arc: "Arc",
  firefox: "Firefox",
  safari: "Safari",
};

/**
 * "Unknown website (Chrome)" — browser time the desktop agent could not read
 * the address of, kept rather than dropped. Matches the backend's label in
 * scheduled reports.
 */
export function unknownWebsiteLabel(browser: string): string {
  const name = BROWSER_NAMES[browser];
  return name ? `Unknown website (${name})` : "Unknown website";
}
