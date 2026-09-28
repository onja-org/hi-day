export type MatchSegment = { text: string; matched: boolean };

/** Splits `label` around the first case-insensitive occurrence of `query`,
 * so a caller can render the matched substring distinctly (e.g. bolded). */
export function splitOnMatch(label: string, query: string): MatchSegment[] {
  if (!query) {
    return [{ text: label, matched: false }];
  }

  const index = label.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) {
    return [{ text: label, matched: false }];
  }

  return [
    { text: label.slice(0, index), matched: false },
    { text: label.slice(index, index + query.length), matched: true },
    { text: label.slice(index + query.length), matched: false },
  ].filter((segment) => segment.text.length > 0);
}
