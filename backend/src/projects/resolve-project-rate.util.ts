/**
 * A per-user ProjectMembership.rate overrides the Project's default rate
 * when set; otherwise the project default applies. Returns null when
 * neither is set — the project has no rate, billable or not.
 */
export function resolveProjectRate(
  project: { rate: string | null },
  projectMembership: { rate: string | null } | null,
): string | null {
  if (projectMembership?.rate != null) {
    return projectMembership.rate;
  }
  return project.rate;
}
