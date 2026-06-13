interface BalanceCardProps {
  label: string;
  value: string;
  tone: "muted" | "info" | "success";
  big?: boolean;
}

export function BalanceCard({ label, value, tone, big }: BalanceCardProps) {
  const cls = tone === "success"
    ? "border-success/30 bg-success/5 text-success"
    : tone === "info"
    ? "border-info/30 bg-info/5 text-info"
    : "border-border bg-muted/30 text-foreground";
  return (
    <div className={`rounded-2xl border p-5 ${cls}`}>
      <p className="text-xs uppercase tracking-wider opacity-70">{label}</p>
      <p className={`mt-1 font-display font-semibold num ${big ? "text-3xl" : "text-2xl"}`}>{value}</p>
    </div>
  );
}
