/** "3 / 10" for a capped link, "3 / ∞" for an unlimited one. */
export function formatInviteLinkUsage(usageCount: number, usageCap: number | null): string {
  return `${usageCount} / ${usageCap === null ? "∞" : usageCap}`;
}
