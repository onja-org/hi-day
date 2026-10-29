/** A comma-separated list of project names as the first letter of each ("dev, Onja, test" → "D, O, T"). "-" (no project) is left as it is. */
export function abbreviateProjects(names: string): string {
  if (names === "-") return names;
  return names
    .split(", ")
    .map((name) => name.trim().charAt(0).toUpperCase())
    .join(", ");
}
