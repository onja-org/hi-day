// A cell starting with one of these is run as a formula by Excel/Sheets —
// dangerous when the value is user-typed (a name, a note). Prefixing a
// quote makes the spreadsheet show it as plain text instead.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function csvField(raw: string): string {
  const value = FORMULA_TRIGGER.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Shared by every `<name>ToCsv` builder (timesheet entries, app/URL activity). */
export function toCsvString(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\n");
}
