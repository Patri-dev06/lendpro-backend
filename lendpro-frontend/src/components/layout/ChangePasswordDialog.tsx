import { useState } from "react";
import { KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, ApiError } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FieldState {
  current: string;
  next: string;
  confirm: string;
}

export function ChangePasswordDialog({ open, onClose }: Props) {
  const { token } = useRole();
  const [fields, setFields] = useState<FieldState>({ current: "", next: "", confirm: "" });
  const [show, setShow]     = useState({ current: false, next: false, confirm: false });
  const [errors, setErrors] = useState<Partial<FieldState>>({});
  const [loading, setLoading] = useState(false);

  function set(key: keyof FieldState, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function toggle(key: keyof typeof show) {
    setShow((s) => ({ ...s, [key]: !s[key] }));
  }

  function reset() {
    setFields({ current: "", next: "", confirm: "" });
    setErrors({});
    setShow({ current: false, next: false, confirm: false });
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errs: Partial<FieldState> = {};
    if (!fields.current) errs.current = "Current password is required.";
    if (!fields.next)    errs.next    = "New password is required.";
    if (!fields.confirm) errs.confirm = "Please confirm your new password.";
    if (fields.next && fields.confirm && fields.next !== fields.confirm)
      errs.confirm = "Passwords do not match.";

    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      await apiRequest("PATCH", "auth/change-password", {
        token,
        body: {
          current_password:      fields.current,
          password:              fields.next,
          password_confirmation: fields.confirm,
        },
      });
      toast.success("Password changed successfully.");
      handleClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors({ current: err.message });
      } else {
        toast.error("Failed to change password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Change Password
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {(["current", "next", "confirm"] as const).map((key) => {
            const labels = { current: "Current Password", next: "New Password", confirm: "Confirm New Password" };
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{labels[key]}</Label>
                <div className="relative">
                  <Input
                    id={key}
                    type={show[key] ? "text" : "password"}
                    value={fields[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className={errors[key] ? "border-destructive pr-9" : "pr-9"}
                    autoComplete={key === "current" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {show[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors[key] && (
                  <p className="text-xs text-destructive">{errors[key]}</p>
                )}
              </div>
            );
          })}

          <p className="text-xs text-muted-foreground">
            Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Password
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
