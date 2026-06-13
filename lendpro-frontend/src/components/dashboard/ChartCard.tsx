import { ExportButtons, type ExportColumn } from "@/components/shared/ExportButtons";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** When provided, renders CSV + PDF export buttons for the chart's underlying data. */
  exportConfig?: {
    filename: string;
    title?: string;
    columns: ExportColumn[];
    rows: (string | number)[][];
  };
}

export function ChartCard({ title, subtitle, children, exportConfig }: ChartCardProps) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {exportConfig && (
          <ExportButtons
            filename={exportConfig.filename}
            title={exportConfig.title ?? title}
            subtitle={subtitle}
            columns={exportConfig.columns}
            rows={exportConfig.rows}
          />
        )}
      </div>
      {children}
    </div>
  );
}
