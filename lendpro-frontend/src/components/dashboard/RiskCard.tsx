interface RiskCardProps {
  title: string;
  items: string[];
  tone: "warning" | "destructive" | "info";
}

export function RiskCard({ title, items, tone }: RiskCardProps) {
  const toneRing = tone === "destructive"
    ? "border-destructive/30 bg-destructive/5"
    : tone === "warning"
    ? "border-warning/30 bg-warning/5"
    : "border-info/30 bg-info/5";
  return (
    <div className={`rounded-2xl border ${toneRing} p-5`}>
      <h4 className="font-display text-sm font-semibold">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />{i}
          </li>
        ))}
      </ul>
    </div>
  );
}
