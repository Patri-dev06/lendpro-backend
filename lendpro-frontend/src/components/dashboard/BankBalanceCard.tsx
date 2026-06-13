import { useState } from "react";
import { PiggyBank } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatPHP } from "@/lib/format";

export function BankBalanceCard() {
  const [bankBalance, setBankBalance] = useState(0);
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-4">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <PiggyBank className="h-3.5 w-3.5" />Bank Balance
      </p>
      {editing ? (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-sm font-semibold">₱</span>
          <Input
            type="number"
            autoFocus
            className="h-7 text-sm font-semibold num"
            value={bankBalance}
            onChange={(e) => setBankBalance(Number(e.target.value) || 0)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
          />
        </div>
      ) : (
        <button className="mt-1 block text-left w-full" onClick={() => setEditing(true)} title="Click to update bank balance">
          <p className="font-display text-xl font-semibold num text-foreground">{formatPHP(bankBalance, { compact: true })}</p>
          <p className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">Click to update</p>
        </button>
      )}
    </div>
  );
}
