import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  sub?: string;
}

interface Props {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = "Search…",
  className,
  error,
  disabled,
}: Props) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery]  = useState("");
  const containerRef       = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = query
    ? options.filter((o) => {
        const q = query.toLowerCase();
        return (
          o.label.toLowerCase().includes(q) ||
          (o.sub?.toLowerCase().includes(q) ?? false)
        );
      })
    : options;

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function handleFocus() {
    setQuery("");
    setOpen(true);
  }

  function handleClick() {
    setQuery("");
    setOpen(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
  }

  function handleSelect(opt: ComboboxOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  const displayValue = open ? query : (selected?.label ?? "");

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onClick={handleClick}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm",
            "ring-offset-background placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive",
          )}
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-muted-foreground/50" />
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover py-1 shadow-md">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-center text-sm text-muted-foreground">No results found.</li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.value}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent",
                  value === opt.value && "bg-accent/50",
                )}
              >
                <Check className={cn("h-4 w-4 shrink-0 text-primary", value === opt.value ? "opacity-100" : "opacity-0")} />
                <span className="truncate font-medium">{opt.label}</span>
                {opt.sub && (
                  <span className="ml-auto truncate text-xs text-muted-foreground">{opt.sub}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
