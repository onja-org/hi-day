/**
 * Who a queued capture or timer action belongs to: one person in one
 * Organisation. Every queue stamps its items with this when they are
 * recorded, and only ever sends the ones matching whoever is logged in now.
 *
 * Needed because the backend keeps one Device per machine whoever logs in
 * on it — a device token says nothing about who was at the keyboard when
 * something was captured, so without this, A's offline backlog would
 * upload under B's login, possibly into another Organisation.
 */
export interface SessionIdentity {
  userId?: string;
  organisationId?: string;
  email: string;
  organisationName: string;
}

export function sessionOwner(session: SessionIdentity): string {
  if (session.userId && session.organisationId) {
    return `user:${session.userId}|org:${session.organisationId}`;
  }
  // A session saved before pairing returned ids. Stable for as long as
  // that session lasts, which is all it needs to be: the next login
  // stores the ids.
  return `email:${session.email.toLowerCase()}|orgName:${session.organisationName}`;
}
