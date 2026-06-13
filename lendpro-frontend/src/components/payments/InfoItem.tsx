interface InfoItemProps {
  label: string;
  value: string;
  highlight?: boolean;
}

export function InfoItem({ label, value, highlight }: InfoItemProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold num ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
