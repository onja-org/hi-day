/** Up to two uppercase initials for an avatar — from a person's name when
 * they have one, otherwise the first letter of their email. */
export function getInitials(name: string | null, fallback = ""): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return fallback.trim().charAt(0).toUpperCase();
  }
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}
