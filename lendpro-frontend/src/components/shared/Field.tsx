import { Label } from "@/components/ui/label";

interface FieldProps {
  label: string;
  full?: boolean;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, full, error, children }: FieldProps) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
