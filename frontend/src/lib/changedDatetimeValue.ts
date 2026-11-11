import { toDatetimeLocalValue } from "@/lib/toDatetimeLocalValue";

/**
 * The time to send for an edit, or undefined when it hasn't changed.
 *
 * The form's time inputs hold whole minutes, while a recorded time usually
 * carries seconds. Sending the field back untouched would trim those
 * seconds, quietly adding time to the entry and writing an audit row for a
 * change nobody made — so a value showing the same minute as the recorded
 * one counts as unchanged. A missing original (an entry with no end yet)
 * means any typed value is a change.
 */
export function changedDatetimeValue(
  typed: string,
  original: string | null | undefined,
): string | undefined {
  if (typed === "") return undefined;
  if (original && toDatetimeLocalValue(original) === typed) return undefined;
  return typed;
}
