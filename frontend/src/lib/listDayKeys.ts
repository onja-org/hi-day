import { addDaysToKey } from "@/lib/timezone";

/** Every day from `fromKey` to `toKey` inclusive, as "2026-10-05" keys. */
export function listDayKeys(fromKey: string, toKey: string): string[] {
  const keys: string[] = [];
  for (let key = fromKey; key <= toKey; key = addDaysToKey(key, 1)) keys.push(key);
  return keys;
}
