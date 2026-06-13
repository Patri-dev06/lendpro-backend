import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, downloadTablePdf, exportDate } from "@/lib/export";
import { formatPHP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ExportColumn {
  header: string;
  align?: "left" | "right";
  /** Format numeric values as Philippine peso in the PDF (raw 2-decimal in CSV). */
  money?: boolean;
}

interface ExportButtonsProps {
  /** Base filename; the current date is appended automatically. */
  filename: string;
  /** Heading shown at the top of the PDF. */
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  /** Row values; money columns should hold raw numbers. */
  rows: (string | number)[][];
  /** Optional summary row rendered as a bold Total row in both formats. */
  totalRow?: (string | number)[];
  disabled?: boolean;
  className?: string;
}

/**
 * Renders matching CSV and PDF export buttons for a table/dataset.
 * CSV keeps raw numbers (spreadsheet-friendly); PDF formats money columns as ₱.
 */
export function ExportButtons({ filename, title, subtitle, columns, rows, totalRow, disabled, className }: ExportButtonsProps) {
  const isEmpty = rows.length === 0;

  const csvCell = (v: string | number, i: number) =>
    columns[i]?.money && typeof v === "number" ? v.toFixed(2) : v;
  const pdfCell = (v: string | number, i: number) =>
    columns[i]?.money && typeof v === "number" ? formatPHP(v) : String(v ?? "");

  function handleCsv() {
    if (isEmpty) return;
    const body = rows.map((r) => r.map(csvCell));
    const data = totalRow ? [...body, totalRow.map(csvCell)] : body;
    downloadCsv(`${filename}-${exportDate()}`, columns.map((c) => c.header), data);
  }

  function handlePdf() {
    if (isEmpty) return;
    downloadTablePdf({
      title,
      subtitle,
      columns: columns.map((c) => ({ header: c.header, align: c.align })),
      rows: rows.map((r) => r.map(pdfCell)),
      totalRow: totalRow ? totalRow.map(pdfCell) : undefined,
      onPopupBlocked: () => toast.error("Popup blocked. Allow popups for this site and try again."),
    });
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleCsv} disabled={disabled || isEmpty} title="Export as CSV">
        <FileSpreadsheet className="h-3.5 w-3.5" />CSV
      </Button>
      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handlePdf} disabled={disabled || isEmpty} title="Export as PDF">
        <Download className="h-3.5 w-3.5" />PDF
      </Button>
    </div>
  );
}
