/**
 * Where a `/open/:destination` link lands inside an organisation, or null
 * for a destination there is no page for. The desktop tray links here:
 * it knows the page it wants but not the organisation's id, since pairing
 * only hands it the organisation's name.
 */
export function organisationPathFor(destination: string, organisationId: number): string | null {
  switch (destination) {
    case "timesheet":
      return `/organisations/${organisationId}/time_entries`;
    case "notes":
      return `/organisations/${organisationId}/activities/notes`;
    default:
      return null;
  }
}
