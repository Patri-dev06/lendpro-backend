import { formatPHP } from "@/lib/format";

interface CollectionEfficiencyBannerProps {
  rate: number;
  collected: number;
  receivable: number;
}

export function CollectionEfficiencyBanner({ rate, collected, receivable }: CollectionEfficiencyBannerProps) {
  const tone = rate >= 90 ? "var(--success)" : rate >= 75 ? "var(--warning)" : "var(--destructive)";
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Collection Efficiency</p>
          <p className="mt-1 font-display text-5xl font-bold num" style={{ color: tone }}>{rate}%</p>
          <p className="mt-1 text-sm text-muted-foreground">{formatPHP(collected)} collected out of {formatPHP(receivable)} total receivable</p>
        </div>
        <div className="w-full flex-1 md:max-w-sm">
          <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-4 rounded-full transition-all duration-500" style={{ width: `${Math.min(rate, 100)}%`, background: tone }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span className="font-semibold" style={{ color: tone }}>{rate}% efficiency</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
