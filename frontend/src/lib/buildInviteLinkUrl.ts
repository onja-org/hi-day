/** The shareable address for an invite link's token, on this app's origin. */
export function buildInviteLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/join?token=${encodeURIComponent(token)}`;
}
