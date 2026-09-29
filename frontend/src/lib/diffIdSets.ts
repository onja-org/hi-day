/** What to add and remove to turn `original` into `target`. */
export function diffIdSets(
  original: Iterable<string>,
  target: Iterable<string>,
): { toAdd: string[]; toRemove: string[] } {
  const originalSet = new Set(original);
  const targetSet = new Set(target);
  return {
    toAdd: [...targetSet].filter((id) => !originalSet.has(id)),
    toRemove: [...originalSet].filter((id) => !targetSet.has(id)),
  };
}
