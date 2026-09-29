/** Case-insensitive substring match on project name; a blank search keeps
 * every project. */
export function filterProjectsByName<T extends { name: string }>(
  projects: T[],
  search: string,
): T[] {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return projects;
  }
  return projects.filter((project) => project.name.toLowerCase().includes(needle));
}
