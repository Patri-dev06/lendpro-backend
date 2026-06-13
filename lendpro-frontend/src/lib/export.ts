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

export interface PdfTableColumn {
  header: string;
  align?: "left" | "right";
}

const escapeHtml = (v: string): string =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Opens a print-ready window with a single table and triggers the browser's
 * print dialog. Choosing "Save as PDF" exports the table — the same approach
 * the report center uses. Cell content is pre-formatted by the caller.
 */
export function downloadTablePdf(opts: {
  title: string;
  subtitle?: string;
  columns: PdfTableColumn[];
  rows: (string | number)[][];
  totalRow?: (string | number)[];
  onPopupBlocked?: () => void;
}): void {
  const { title, subtitle, columns, rows, totalRow, onPopupBlocked } = opts;
  const cell = (v: string | number, i: number) =>
    `<td${columns[i]?.align === "right" ? ' class="r"' : ""}>${escapeHtml(String(v ?? ""))}</td>`;

  const thead = `<tr>${columns
    .map((c) => `<th${c.align === "right" ? ' class="r"' : ""}>${escapeHtml(c.header)}</th>`)
    .join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("");
  const tfoot = totalRow ? `<tr class="tot">${totalRow.map(cell).join("")}</tr>` : "";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px}h2{font-size:15px;margin-bottom:4px}p.sub{font-size:10px;color:#666;margin-bottom:14px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f2f2f2;font-weight:600}.r{text-align:right}tr.tot td{background:#f5f5f5;font-weight:700;border-top:2px solid #888}@media print{body{padding:0}}</style>
</head><body>
<h2>${escapeHtml(title)}</h2>
<p class="sub">${subtitle ? escapeHtml(subtitle) + " · " : ""}Generated: ${new Date().toLocaleString("en-PH")}</p>
<table><thead>${thead}</thead><tbody>${tbody}</tbody>${totalRow ? `<tfoot>${tfoot}</tfoot>` : ""}</table>
</body></html>`;

  const w = window.open("", "_blank", "width=960,height=720");
  if (!w) { onPopupBlocked?.(); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
