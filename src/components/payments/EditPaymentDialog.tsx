import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, ApiError } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP } from "@/lib/format";
import { toast } from "sonner";

export interface PaymentToEdit {
  id: number;
  amount: number;
  payment_date: string;
  previous_balance: number;
  new_balance: number;
  remarks: string | null;
  client: { name: string };
  loan: { release_date: string } | null;
}

interface Props {
  payment: PaymentToEdit | null;
  onClose: () => void;
  onSaved: () => void;
  adminPin?: string;
}

export function EditPaymentDialog({ payment, onClose, onSaved, adminPin }: Props) {
  const { token } = useRole();
  const [amount, setAmount]   = useState(0);
  const [date, setDate]       = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (payment) {
      setAmount(payment.amount);
      setDate(payment.payment_date.slice(0, 10));
      setRemarks(payment.remarks ?? "");
    }
  }, [payment?.id]);

  const previewNewBalance = payment
    ? Math.max(0, payment.previous_balance - amount)
    : 0;

  const beforeRelease =
    !!payment?.loan?.release_date && !!date && date < payment.loan.release_date;

  async function handleSave() {
    if (!payment || !token || amount <= 0 || !date) return;
    setSaving(true);
    try {
      await apiRequest("PATCH", `payments/${payment.id}`, {
        token,
        body: {
          amount,
          payment_date: date,
          remarks: remarks || null,
          ...(adminPin ? { admin_pin: adminPin } : {}),
        },
      });
      toast.success("Payment updated.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update payment.");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (!saving) onClose();
  }

  return (
    <Dialog open={!!payment} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Payment</DialogTitle>
        </DialogHeader>

        {payment && (
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Client: <span className="font-medium text-foreground">{payment.client.name}</span>
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">Amount Paid (₱)</Label>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
              />
              {amount !== payment.amount && (
                <p className="text-xs text-muted-foreground">
                  Previous balance: {formatPHP(payment.previous_balance)} →
                  New balance: <span className="font-medium text-foreground">{formatPHP(previewNewBalance)}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payment Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={beforeRelease ? "border-destructive ring-destructive" : ""}
              />
              {beforeRelease && (
                <p className="text-xs text-destructive">
                  Date cannot be before the loan release date ({payment!.loan!.release_date}).
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Remarks</Label>
              <Textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes…"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || amount <= 0 || !date || beforeRelease}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
