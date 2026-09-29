/**
 * Splits CSV text into rows of fields (RFC 4180): quoted fields may hold
 * commas, newlines and doubled `""` quotes; CRLF and LF line endings both
 * work; a leading UTF-8 byte-order mark (Excel adds one) is dropped; rows
 * that are entirely blank are skipped.
 */
export function parseCsv(text: string): string[][] {
  const input = text.startsWith("﻿") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  function endRow() {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }
    row = [];
    field = "";
  }

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      endRow();
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    endRow();
  }

  return rows;
}
