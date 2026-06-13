interface FinStatProps {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: "info" | "success" | "default";
  sub?: string;
}

export function FinStat({ label, value, icon: Icon, tone, sub }: FinStatProps) {
  const cls = tone === "success" ? "text-success bg-success/10"
    : tone === "info" ? "text-info bg-info/10"
    : "text-muted-foreground bg-muted/50";
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className={`mb-2 inline-flex rounded-lg p-1.5 ${cls}`}><Icon className="h-3.5 w-3.5" /></div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-xl font-semibold num">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
