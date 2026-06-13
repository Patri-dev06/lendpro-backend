interface SumRowProps {
  label: string;
  value: string;
  bold?: boolean;
}

export function SumRow({ label, value, bold }: SumRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="opacity-80">{label}</span>
      <span className={`num ${bold ? "font-display text-lg font-semibold" : "text-sm"}`}>{value}</span>
    </div>
  );
}
