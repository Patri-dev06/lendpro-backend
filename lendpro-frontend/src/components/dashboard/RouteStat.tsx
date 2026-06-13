interface RouteStatProps {
  label: string;
  value: number;
  accent?: "success" | "warning";
}

export function RouteStat({ label, value, accent }: RouteStatProps) {
  const tone = accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-display text-lg font-semibold num ${tone}`}>{value}</span>
    </div>
  );
}
