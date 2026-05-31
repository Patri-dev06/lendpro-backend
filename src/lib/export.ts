/**
 * Triggers a CSV file download in the browser.
 * Adds a UTF-8 BOM so Excel opens it correctly with Philippine peso and special characters.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[],
): void;
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void;
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[] | (string | number | null | undefined)[][],
): void {
  const escape = (v: string | number | null | undefined): string => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const normalised: (string | number | null | undefined)[][] =
    rows.length > 0 && !Array.isArray(rows[0])
      ? [rows as (string | number | null | undefined)[]]
      : (rows as (string | number | null | undefined)[][]);

  const csv = [headers, ...normalised]
    .map((row) => row.map(escape).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Returns today's date as YYYY-MM-DD for use in filenames. */
export function exportDate(): string {
  return new Date().toISOString().slice(0, 10);
}
