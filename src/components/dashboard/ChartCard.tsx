import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onExport?: () => void;
}

export function ChartCard({ title, subtitle, children, onExport }: ChartCardProps) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {onExport && (
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onExport}>
            <Download className="h-3.5 w-3.5" />Export
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}
