/**
 * Whether two query keys name the same paged list, with the page number
 * as each key's last element — i.e. the user turned a page rather than
 * changing what is being listed.
 */
export function differsOnlyByPage(
  previousKey: readonly unknown[],
  nextKey: readonly unknown[],
): boolean {
  return (
    JSON.stringify(previousKey.slice(0, -1)) ===
    JSON.stringify(nextKey.slice(0, -1))
  );
}
