import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus, X, Loader2, CalendarOff, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/finance/PageHeader";
import { PermissionGuard } from "@/components/shared/AccessRestricted";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — BuenaMano" }] }),
  component: SettingsPage,
});

interface ApiSetting {
  key: string;
  value: string | null;
}

function SettingsPage() {
  const { token, role } = useRole();
  const canEdit = role === "admin" || role === "sysadmin";

  // Organisation
  const [companyName, setCompanyName]     = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone]   = useState("");
  const [companyEmail, setCompanyEmail]   = useState("");

  const TERM_OPTIONS = [30, 45, 60] as const;

  // Loan defaults
  const [interestRate, setInterestRate]       = useState("");
  const [serviceCharge, setServiceCharge]     = useState("");
  const [defaultLoanTerm, setDefaultLoanTerm] = useState(60);

  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  const [pinConfigured, setPinConfigured] = useState(false);
  const [newPin, setNewPin]               = useState("");
  const [confirmPin, setConfirmPin]       = useState("");
  const [pinSaving, setPinSaving]         = useState(false);

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<ApiSetting[]>("GET", "settings", { token });
      const map = Object.fromEntries(data.map((s) => [s.key, s.value ?? ""]));
      setCompanyName(map.company_name    ?? "");
      setCompanyAddress(map.company_address ?? "");
      setCompanyPhone(map.company_phone  ?? "");
      setCompanyEmail(map.company_email  ?? "");
      setInterestRate(map.default_interest_rate  ?? "20");
      setServiceCharge(map.default_service_charge ?? "0");
      const storedTerm = parseInt(map.default_loan_term ?? "52", 10);
      setDefaultLoanTerm([30, 45, 60].includes(storedTerm) ? storedTerm : 60);
      setPinConfigured(map.admin_pin_configured === "1");
      try {
        const parsed = JSON.parse(map.holidays ?? "[]");
        if (Array.isArray(parsed)) setHolidays(parsed.filter((h: unknown) => h && typeof h === "object").sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date)));
      } catch {
        setHolidays([]);
      }
    } catch {
      toast.error("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  function addHoliday() {
    if (!newHolidayDate) return;
    if (holidays.some((h) => h.date === newHolidayDate)) {
      setNewHolidayDate(""); setNewHolidayName(""); return;
    }
    setHolidays((prev) => [...prev, { date: newHolidayDate, name: newHolidayName.trim() || newHolidayDate }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewHolidayDate(""); setNewHolidayName("");
  }

  function removeHoliday(date: string) {
    setHolidays((prev) => prev.filter((h) => h.date !== date));
  }

  async function handleSavePin() {
    if (!token) return;
    if (newPin.length < 4) { toast.error("PIN must be at least 4 characters."); return; }
    if (newPin !== confirmPin) { toast.error("PINs do not match."); return; }
    setPinSaving(true);
    try {
      await apiRequest("PATCH", "settings", { token, body: { settings: [{ key: "admin_pin", value: newPin }] } });
      setPinConfigured(true);
      setNewPin(""); setConfirmPin("");
      toast.success(pinConfigured ? "Admin PIN updated." : "Admin PIN set.");
    } catch { toast.error("Failed to save PIN."); }
    finally { setPinSaving(false); }
  }

  async function handleRemovePin() {
    if (!token) return;
    if (!window.confirm("Remove the admin PIN? Users will no longer be able to override delete/edit actions.")) return;
    setPinSaving(true);
    try {
      await apiRequest("PATCH", "settings", { token, body: { settings: [{ key: "admin_pin", value: null }] } });
      setPinConfigured(false);
      setNewPin(""); setConfirmPin("");
      toast.success("Admin PIN removed.");
    } catch { toast.error("Failed to remove PIN."); }
    finally { setPinSaving(false); }
  }

  async function handleSave() {
    if (!token) return;
    const irNum = parseFloat(interestRate);
    const scNum = parseFloat(serviceCharge);
    if (isNaN(irNum) || irNum < 0 || irNum > 100) {
      toast.error("Interest rate must be between 0 and 100.");
      return;
    }
    if (isNaN(scNum) || scNum < 0 || scNum > 100) {
      toast.error("Processing fee rate must be between 0 and 100%.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("PATCH", "settings", {
        token,
        body: {
          settings: [
            { key: "company_name",            value: companyName },
            { key: "company_address",          value: companyAddress },
            { key: "company_phone",            value: companyPhone },
            { key: "company_email",            value: companyEmail },
            { key: "default_interest_rate",  value: String(irNum) },
            { key: "default_service_charge", value: String(scNum) },
            { key: "default_loan_term",      value: String(defaultLoanTerm) },
            { key: "holidays",               value: JSON.stringify(holidays) },
          ],
        },
      });
      toast.success("Settings saved.", { description: "All changes have been applied." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PermissionGuard permission="settings:read">
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="settings:read">
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Configure your BuenaMano workspace." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Organisation */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h3 className="font-display text-base font-semibold">Organization</h3>
          <p className="text-xs text-muted-foreground">Basic company information shown on reports and documents.</p>
          <div className="mt-5 space-y-3">
            <Field label="Company name">
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!canEdit} placeholder="BuenaMano Lending Corporation" />
            </Field>
            <Field label="Address">
              <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} disabled={!canEdit} placeholder="123 Main St, City" />
            </Field>
            <Field label="Phone">
              <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} disabled={!canEdit} placeholder="+63 912 345 6789" />
            </Field>
            <Field label="Email">
              <Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} disabled={!canEdit} placeholder="info@buenamano.ph" />
            </Field>
            <Field label="Currency"><Input value="PHP — Philippine Peso" readOnly className="bg-muted/40 text-muted-foreground" /></Field>
            <Field label="Time zone"><Input value="Asia/Manila (GMT+8)" readOnly className="bg-muted/40 text-muted-foreground" /></Field>
          </div>
        </div>

        {/* Loan defaults */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
          <div>
            <h3 className="font-display text-base font-semibold">Loan defaults</h3>
            <p className="text-xs text-muted-foreground">These values pre-fill the loan creation form. Staff can still override them per loan.</p>
          </div>

          <Field label="Default interest rate (% of principal)">
            <div className="relative">
              <Input
                type="number" min={0} max={100} step="any"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                disabled={!canEdit}
                className="pr-8"
                placeholder="20"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              e.g. 20% on a ₱10,000 principal = ₱2,000 interest auto-filled.
            </p>
          </Field>

          <Field label="Default processing fee rate (%)">
            <div className="relative">
              <Input
                type="number" min={0} max={100} step="any"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
                disabled={!canEdit}
                className="pr-8"
                placeholder="0"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              e.g. 5% on a ₱10,000 principal = ₱500 processing fee auto-filled.
            </p>
          </Field>

          <div className="space-y-2">
            <Label className="text-xs">Default loan term</Label>
            <Select
              value={String(defaultLoanTerm)}
              onValueChange={(v) => setDefaultLoanTerm(Number(v))}
              disabled={!canEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERM_OPTIONS.map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {{ 30: "1 Month", 45: "1.5 Months", 60: "2 Months" }[t] ?? `${t} days`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Pre-selects the term when creating a new loan. Staff can still change it per loan.
            </p>
          </div>
        </div>

      </div>

      {/* Holidays */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-muted-foreground" />
            Non-collection days (Holidays)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            These dates are skipped when computing due dates and generating collection schedules, just like Sundays.
          </p>
        </div>

        {holidays.length === 0 ? (
          <p className="text-sm text-muted-foreground">No holidays configured.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {holidays.map((h) => (
              <span key={h.date} className="flex items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1 text-xs font-medium">
                <span className="text-muted-foreground">{h.date}</span>
                <span>{h.name}</span>
                {canEdit && (
                  <button type="button" onClick={() => removeHoliday(h.date)} className="ml-0.5 rounded-full hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className="flex h-9 w-44 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name (optional)</Label>
              <input
                type="text"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHoliday(); } }}
                placeholder="e.g. Christmas Day"
                className="flex h-9 w-52 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addHoliday} disabled={!newHolidayDate} className="h-9">
              <Plus className="mr-1 h-3.5 w-3.5" />Add holiday
            </Button>
          </div>
        )}
      </div>

      {/* Admin Override PIN — visible to admin only */}
      {role === "admin" && (
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Admin Override PIN
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Any user who knows this PIN can delete or edit payment records directly, without waiting for admin approval — like a supervisor override.
            </p>
          </div>

          {pinConfigured ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 dark:border-emerald-800 dark:bg-emerald-950/20">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">A PIN is currently configured.</span>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-950/20">
              <span className="text-sm text-amber-700 dark:text-amber-400">No PIN configured — PIN override is unavailable until one is set.</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={pinConfigured ? "New PIN" : "Set PIN"}>
              <Input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="Min. 4 characters" />
            </Field>
            <Field label="Confirm PIN">
              <Input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} placeholder="Re-enter PIN" />
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleSavePin} disabled={pinSaving || !newPin || !confirmPin} className="bg-primary text-primary-foreground hover:bg-primary-glow">
              {pinSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pinConfigured ? "Update PIN" : "Set PIN"}
            </Button>
            {pinConfigured && (
              <Button variant="outline" onClick={handleRemovePin} disabled={pinSaving} className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30">
                Remove PIN
              </Button>
            )}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary-glow"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
    </PermissionGuard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
