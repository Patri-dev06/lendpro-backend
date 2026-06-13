import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  new: "bg-info/10 text-info border-info/20",
  renew: "bg-purple/10 text-purple border-purple/20",
  overdue: "bg-warning/15 text-warning border-warning/30",
  "past-due": "bg-destructive/10 text-destructive border-destructive/20",
  paid: "bg-success/10 text-success border-success/20",
  partial: "bg-info/10 text-info border-info/20",
  missed: "bg-warning/15 text-warning border-warning/30",
  pending: "bg-muted text-muted-foreground border-border",
  "catch-up": "bg-purple/10 text-purple border-purple/20",
  Active: "bg-success/10 text-success border-success/20",
  Inactive: "bg-muted text-muted-foreground border-border",
};

const labels: Record<string, string> = {
  new: "New Loan",
  renew: "Reloan",
  overdue: "Overdue +3 Days",
  "past-due": "Past Due +30 Days",
  paid: "Fully Paid",
  partial: "Partial",
  missed: "Missed",
  pending: "Pending",
  "catch-up": "Catch-Up",
};

export function StatusBadge({ status, className, children }: { status: string; className?: string; children?: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        styles[status] ?? "bg-muted text-muted-foreground border-border",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children ?? labels[status] ?? status}
    </span>
  );
}
