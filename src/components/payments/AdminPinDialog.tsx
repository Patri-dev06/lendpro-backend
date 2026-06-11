import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  actionDescription: string;
  onConfirm: (pin: string) => Promise<void>;
  onRequestInstead?: () => void;
  onCancel: () => void;
}

export function AdminPinDialog({ open, actionDescription, onConfirm, onRequestInstead, onCancel }: Props) {
  const [pin, setPin]         = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setPin(""); setError(null); }
  }, [open]);

  async function handleSubmit() {
    if (!pin.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(pin);
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect PIN.");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setPin(""); setError(null); onCancel();
  }

  function handleRequestInstead() {
    setPin(""); setError(null); onRequestInstead?.();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Admin Authorization
          </DialogTitle>
          <DialogDescription>{actionDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Administrator PIN</Label>
            <Input
              type="password"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              placeholder="Enter admin PIN…"
              autoFocus
              className={error ? "border-destructive" : ""}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handleSubmit} disabled={!pin.trim() || loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify &amp; Proceed
            </Button>
            {onRequestInstead && (
              <Button variant="outline" onClick={handleRequestInstead} disabled={loading} className="w-full">
                Request Deletion Instead
              </Button>
            )}
            <Button variant="ghost" onClick={handleCancel} disabled={loading} className="w-full text-muted-foreground">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
