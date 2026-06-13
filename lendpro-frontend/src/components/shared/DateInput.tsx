import { useRef } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

function formatDisplay(value: string | undefined): string {
  if (!value) return "";
  // Parse as local time to avoid UTC-offset shift
  const d = new Date(value + "T00:00:00");
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

export function DateInput({ className, error, value, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (!ref.current) return;
    try {
      (ref.current as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      ref.current.focus();
    }
  }

  const display = formatDisplay(value as string | undefined);

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1">
        {/* Formatted display */}
        <div
          onClick={openPicker}
          className={cn(
            "flex h-9 w-full cursor-pointer select-none items-center rounded-md border border-input bg-background px-3 py-2 text-sm",
            error && "border-destructive",
            !display && "text-muted-foreground",
            className,
          )}
        >
          {display || "Select a date"}
        </div>
        {/* Native date input — invisible but present so showPicker() works */}
        <input
          ref={ref}
          type="date"
          value={value}
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", top: 0, left: 0, width: "100%", height: "100%" }}
          {...props}
        />
      </div>
      <button
        type="button"
        tabIndex={-1}
        onClick={openPicker}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Calendar className="h-4 w-4" />
      </button>
    </div>
  );
}
