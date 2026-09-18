/** Local calendar date as YYYY-MM-DD — `toISOString` would shift the date
 * near midnight for any server timezone with a non-zero UTC offset. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
