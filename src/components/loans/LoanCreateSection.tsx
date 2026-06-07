import { useState, useEffect, useCallback, useRef } from "react";
import { Sparkles, Printer, FileText, ClipboardList, Loader2, AlertTriangle } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/Field";
import { SumRow } from "@/components/shared/SumRow";
import { SearchableCombobox } from "@/components/shared/SearchableCombobox";
import { DateInput } from "@/components/shared/DateInput";
import { formatPHP, formatDate, addDays } from "@/lib/format";
import { LOAN_TYPE_LABELS, type LoanType } from "@/lib/loan-constants";
import { calcInterest, calcServiceCharge, calcDailyPayment } from "@/lib/loan-calc";
import { InvoiceDocument }       from "@/components/loans/print/InvoiceDocument";
import { TILADocument }          from "@/components/loans/print/TILADocument";
import { LoanAgreementDocument } from "@/components/loans/print/LoanAgreementDocument";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

interface ApiClient {
  id: number;
  number: string;
  name: string;
  store_name: string;
  address: string;
  phone: string;
  email: string | null;
  type: string;
  status: string;
  has_outstanding_loan: boolean;
  approval_status: string;
}

export interface ApiLoan {
  id: number;
  number: string;
  client_id: number;
  collector_id: number;
  loan_type: string;
  principal: number;
  interest: number;
  service_charge: number;
  total_receivable: number;
  daily_payment: number;
  term_days: number;
  holiday_count: number;
  current_balance: number;
  release_date: string;
  due_date: string;
  expected_end_date: string;
  status: string;
  remarks: string | null;
  client: ApiClient;
  collector: { id: number; name: string; area: string };
}

interface Props {
  token: string | null;
  onLoanCreated: (loan: ApiLoan) => void;
  initialClientId?: number;
}

interface ApiSetting { key: string; value: string | null; }

export function LoanCreateSection({ token, onLoanCreated, initialClientId }: Props) {
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const TERM_OPTIONS = [30, 45, 60] as const;
  const termLabel = (days: number) => ({ 30: "1 Month", 45: "1.5 Months", 60: "2 Months" }[days] ?? `${days} days`);

  // Settings-driven defaults
  const [defaultScRate, setDefaultScRate] = useState(0);
  const [holidays, setHolidays] = useState<string[]>([]);

  const [loanType, setLoanType] = useState<LoanType>("new-loan");
  const [clientId, setClientId] = useState<number | null>(null);
  const [principal, setPrincipal] = useState(10000);
  const [interest, setInterest]   = useState(0);
  const [sc, setSc]               = useState(0);
  const [termDays, setTermDays]   = useState<number>(60);
  const [holidayCount, setHolidayCount] = useState(0);
  const [daily, setDaily]         = useState(0);
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks]     = useState("");
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [createdLoanNumber, setCreatedLoanNumber] = useState<string | undefined>(undefined);
  const [clientSearchBy, setClientSearchBy] = useState<"name" | "number" | "store">("name");

  const tilaRef      = useRef<HTMLDivElement>(null);
  const invoiceRef   = useRef<HTMLDivElement>(null);
  const loanFormRef  = useRef<HTMLDivElement>(null);

  const handlePrintTILA      = useReactToPrint({ contentRef: tilaRef,     documentTitle: "TILA" });
  const handlePrintInvoice   = useReactToPrint({ contentRef: invoiceRef,  documentTitle: "Invoice" });
  const handlePrintLoanForm  = useReactToPrint({ contentRef: loanFormRef, documentTitle: "Loan Agreement" });

  const fetchDropdowns = useCallback(async () => {
    if (!token) return;
    try {
      const [cls, settingsRaw] = await Promise.all([
        apiRequest<ApiClient[]>("GET", "clients", { token }),
        apiRequest<ApiSetting[]>("GET", "settings", { token }),
      ]);

      // Parse settings
      const smap    = Object.fromEntries(settingsRaw.map((s) => [s.key, s.value ?? ""]));
      const scRate  = parseFloat(smap.default_service_charge ?? "0") || 0;
      const defSc   = Math.round(10000 * scRate / 100);
      const stored  = parseInt(smap.default_loan_term ?? "52", 10);
      const defTerm = ([30, 45, 60] as number[]).includes(stored) ? stored : 60;

      let parsedHolidays: string[] = [];
      try {
        const h = JSON.parse(smap.holidays ?? "[]");
        if (Array.isArray(h)) parsedHolidays = h.map((x: { date?: string } | string) => (typeof x === "string" ? x : x.date ?? "")).filter(Boolean);
      } catch { /* keep empty */ }

      setDefaultScRate(scRate);
      setHolidays(parsedHolidays);
      setSc(defSc);
      setTermDays(defTerm);

      const defaultInterest = calcInterest(10000, defTerm);
      setInterest(defaultInterest);
      recalcDailyRaw(10000, defaultInterest, defSc, defTerm);

      setClients(cls);
      const preselect   = initialClientId ? cls.find((c) => c.id === initialClientId) : null;
      const firstClient = preselect ?? (cls.length > 0 ? cls[0] : null);
      if (firstClient) setClientId(firstClient.id);
    } catch {
      toast.error("Failed to load clients.");
    } finally {
      setLoadingData(false);
    }
  }, [token]);

  useEffect(() => { fetchDropdowns(); }, [fetchDropdowns]);

  // Auto-derive loan type from the selected client's type field
  useEffect(() => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    setLoanType(client.type === "renew" ? "reloan" : "new-loan");
  }, [clientId, clients]);

  const totalLoanAmount = principal + interest;
  const totalReceivable = totalLoanAmount;          // processing fee is deducted from release, not added to balance
  const amountToRelease = principal - sc;           // what the client actually receives
  const dueDate = date ? addDays(date, termDays + holidayCount) : null;

  function recalcDailyRaw(p: number, i: number, _s: number, t: number) {
    setDaily(calcDailyPayment(p + i, t));
  }

  function recalcDaily(p: number, i: number, s: number, t: number) {
    recalcDailyRaw(p, i, s, t);
  }

  function handlePrincipalChange(p: number) {
    setPrincipal(p);
    const autoInterest = calcInterest(p, termDays);
    const autoSc = calcServiceCharge(p, defaultScRate);
    setInterest(autoInterest);
    setSc(autoSc);
    recalcDaily(p, autoInterest, autoSc, termDays);
    setErrors((e) => ({ ...e, principal: "" }));
  }

  function handleTermChange(t: number) {
    setTermDays(t);
    const autoInterest = calcInterest(principal, t);
    setInterest(autoInterest);
    recalcDaily(principal, autoInterest, sc, t);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!clientId)      e.client    = "Select a client.";
    if (principal <= 0) e.principal = "Principal must be greater than 0.";
    if (sc < 0)            e.sc        = "Processing fee cannot be negative.";
    if (daily <= 0)        e.daily     = "Daily payment must be greater than 0.";
    if (!date)             e.date      = "Release date is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate() || !token) return;
    setSaving(true);
    try {
      const loan = await apiRequest<ApiLoan>("POST", "loans", {
        token,
        body: {
          client_id:  clientId,
          loan_type:  loanType,
          principal,
          interest,
          service_charge: sc,
          daily_payment:  daily,
          term_days:      termDays,
          holiday_count:  holidayCount,
          release_date:   date,
          remarks:        remarks || null,
        },
      });
      toast.success(`${LOAN_TYPE_LABELS[loanType]} created`, {
        description: `${loan.number} — ${termDays}-day schedule generated.`,
      });
      setCreatedLoanNumber(loan.number);
      onLoanCreated(loan);
      // Reset form — restore setting-based defaults, clear all fields
      const resetPrincipal = 10000;
      const resetSc        = Math.round(resetPrincipal * defaultScRate / 100);
      const resetTerm      = termDays;
      const resetInterest  = calcInterest(resetPrincipal, resetTerm);
      setPrincipal(resetPrincipal);
      setInterest(resetInterest);
      setSc(resetSc);
      setTermDays(resetTerm);
      recalcDailyRaw(resetPrincipal, resetInterest, resetSc, resetTerm);
      setHolidayCount(0);
      setRemarks(""); setErrors({});
      setDate(new Date().toISOString().slice(0, 10));
      setClientId(null);
      setLoanType("new-loan");
      setCreatedLoanNumber(undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create loan.");
    } finally {
      setSaving(false);
    }
  }

  const selectedClient = clients.find((c) => c.id === clientId);
  const canPrint       = !!selectedClient && principal > 0 && !!date;

  const printParams = {
    client:   selectedClient ?? { name: "", store_name: "", address: "", phone: "" },
    loanType, date, principal, interest, sc,
    totalLoanAmount, totalReceivable, daily, termDays, dueDate, remarks,
    loanNumber: createdLoanNumber,
  };

  if (loadingData) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs shrink-0">Loan type</Label>
            <Select
              value={loanType}
              onValueChange={(v) => setLoanType(v as LoanType)}
              disabled={!!selectedClient}
            >
              <SelectTrigger className="h-8 w-44 text-sm font-semibold"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(LOAN_TYPE_LABELS) as [LoanType, string][])
                  .filter(([v]) => v !== "reconstruct")
                  .filter(([v]) => {
                    if (!selectedClient) return true;
                    return selectedClient.type === "renew" ? v === "reloan" : v === "new-loan";
                  })
                  .map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {selectedClient && (
              <span className="text-[11px] text-muted-foreground">
                auto-set from client type
              </span>
            )}
          </div>
          <span className="rounded-full bg-info/10 px-2.5 py-0.5 text-xs font-medium text-info">Auto-computed</span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Select client</Label>
              <Select value={clientSearchBy} onValueChange={(v) => setClientSearchBy(v as typeof clientSearchBy)}>
                <SelectTrigger className="h-6 w-36 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Client name</SelectItem>
                  <SelectItem value="number">Client #</SelectItem>
                  <SelectItem value="store">Business name</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {errors.client && <p className="text-[11px] text-destructive">{errors.client}</p>}
            <SearchableCombobox
              options={clients.map((c) => ({
                value: c.id.toString(),
                label: c.name,
                sub: clientSearchBy === "number"
                  ? `#${c.number ?? c.id}`
                  : clientSearchBy === "store"
                    ? c.store_name
                    : c.store_name,
              }))}
              value={clientId?.toString() ?? ""}
              onChange={(v) => {
                setClientId(Number(v));
                setCreatedLoanNumber(undefined);
                setErrors((e) => ({ ...e, client: "" }));
              }}
              placeholder={
                clientSearchBy === "number" ? "Type client #…"
                : clientSearchBy === "store" ? "Type business name…"
                : "Type client name…"
              }
              error={!!errors.client}
            />
          </div>

          <Field label="Principal loan (₱)" error={errors.principal}>
            <Input
              type="number" min={0}
              value={principal === 0 ? "" : principal}
              placeholder="e.g. 10,000"
              className={errors.principal ? "border-destructive" : ""}
              onChange={(e) => handlePrincipalChange(Number(e.target.value) || 0)}
            />
          </Field>

          <Field label="Interest (₱)">
            <Input
              value={formatPHP(interest)}
              readOnly
              className="bg-muted/40 text-muted-foreground"
            />
          </Field>

          <Field label="Term of loan">
            <Select value={String(termDays)} onValueChange={(v) => handleTermChange(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TERM_OPTIONS.map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {termLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Holidays within term">
            <Select value={String(holidayCount)} onValueChange={(v) => setHolidayCount(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 0 ? "None" : `${n} holiday${n > 1 ? "s" : ""} (+${n} day${n > 1 ? "s" : ""})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={`Processing fee (₱)${defaultScRate > 0 ? ` — ${defaultScRate}% of principal` : ""}`} error={errors.sc}>
            <Input
              type="number" min={0} value={sc}
              className={errors.sc ? "border-destructive" : ""}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setSc(v);
                recalcDaily(principal, interest, v, termDays);
                setErrors((err) => ({ ...err, sc: "" }));
              }}
            />
          </Field>

          <Field label="Loan release date" error={errors.date}>
            <DateInput
              value={date}
              error={!!errors.date}
              onChange={(e) => { setDate(e.target.value); setErrors((err) => ({ ...err, date: "" })); }}
            />
          </Field>

          <Field label="Due date (computed)">
            <Input value={dueDate ? formatDate(dueDate) : "—"} readOnly className="bg-muted/40 text-muted-foreground" />
          </Field>

          <Field label="Daily payment (₱)" error={errors.daily}>
            <Input
              type="number" min={0} value={daily || ""}
              className={errors.daily ? "border-destructive" : ""}
              onChange={(e) => { setDaily(Number(e.target.value) || 0); setErrors((err) => ({ ...err, daily: "" })); }}
            />
          </Field>

          <Field label="Remarks (optional)" full>
            <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any internal notes about this loan…" />
          </Field>
        </div>

        {/* Hidden print targets — rendered off-screen, printed via react-to-print */}
        <div style={{ position: "absolute", left: "-9999px", top: 0, width: "210mm" }}>
          <TILADocument          ref={tilaRef}     {...printParams} />
          <InvoiceDocument       ref={invoiceRef}  {...printParams} />
          <LoanAgreementDocument ref={loanFormRef} {...printParams} />
        </div>

        {/* Warnings */}
        {selectedClient?.has_outstanding_loan && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{selectedClient.name}</strong> already has an active outstanding loan.
              A new loan cannot be created until the existing loan is fully paid or restructured.
              Use <strong>Reconstruct</strong> from the active loan ledger instead.
            </span>
          </div>
        )}
        {selectedClient?.approval_status === "pending_approval" && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{selectedClient.name}</strong> is pending Administrator approval. You cannot create a loan until this client is approved.
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => handlePrintTILA()} disabled={!canPrint}>
            <FileText className="mr-1.5 h-4 w-4" />Print TILA
          </Button>
          <Button variant="outline" onClick={() => handlePrintInvoice()} disabled={!canPrint}>
            <ClipboardList className="mr-1.5 h-4 w-4" />Print Invoice
          </Button>
          <Button variant="outline" onClick={() => handlePrintLoanForm()} disabled={!canPrint}>
            <Printer className="mr-1.5 h-4 w-4" />Print Loan Form
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary-glow"
            onClick={handleCreate}
            disabled={saving || !!selectedClient?.has_outstanding_loan || selectedClient?.approval_status === "pending_approval"}
          >
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            {saving ? "Creating…" : "Create loan & generate schedule"}
          </Button>
        </div>
      </div>

      {/* Summary panel */}
      <div className="rounded-2xl border bg-linear-to-br from-primary to-primary-glow p-6 text-primary-foreground shadow-md">
        <h3 className="font-display text-base font-semibold">Loan summary</h3>
        <p className="text-xs opacity-75">Live calculation based on inputs</p>

        {/* Dates — top of summary */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-primary-foreground/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider opacity-70">Date</p>
            <p className="mt-0.5 text-sm font-semibold">
              {date ? formatDate(date) : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-primary-foreground/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider opacity-70">Due Date</p>
            <p className="mt-0.5 text-sm font-semibold">
              {dueDate ? formatDate(dueDate) : "—"}
            </p>
          </div>
        </div>

        {/* Amounts */}
        <dl className="mt-4 space-y-3 text-sm">
          <SumRow label="Principal loan" value={formatPHP(principal)} />
          <SumRow label="Interest"       value={formatPHP(interest)} />
          <div className="my-1 border-t border-primary-foreground/20" />
          <SumRow label="Total loan amount" value={formatPHP(totalLoanAmount)} bold />
          <SumRow label="Fees"           value={formatPHP(sc)} />
          <SumRow label="Net (amount released)" value={formatPHP(amountToRelease)} />
          <div className="my-1 border-t border-primary-foreground/20" />
          <SumRow label="Daily payment"  value={formatPHP(daily)} bold />
        </dl>
      </div>
    </div>
  );
}
