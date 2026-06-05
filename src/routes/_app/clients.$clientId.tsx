import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Loader2, MapPin, Phone, RefreshCw, Store } from "lucide-react";
import { PageHeader } from "@/components/finance/PageHeader";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateInput } from "@/components/shared/DateInput";
import { formatPHP, formatDate, addDays } from "@/lib/format";
import { LOAN_TYPE_LABELS } from "@/lib/loan-constants";
import { calcInterest, calcServiceCharge, calcDailyPayment } from "@/lib/loan-calc";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { toast } from "sonner";

/* ── Types ───────────────────────────────────────────────────────────────── */

interface ApiCollector { id: number; name: string; area: string; code: string; }
interface ApiSetting   { key: string; value: string | null; }

interface ApiScheduleRow {
  id: number;
  scheduled_date: string;
  expected: number;
  actual: number;
  balance_after: number;
  status: string;
}

interface ApiLoan {
  id: number;
  number: string;
  loan_type: string;
  principal: number;
  interest: number;
  service_charge: number;
  total_receivable: number;
  daily_payment: number;
  term_days: number;
  current_balance: number;
  release_date: string;
  due_date: string;
  status: string;
  remarks: string | null;
  schedule_rows?: ApiScheduleRow[];
}

interface ApiPayment {
  id: number;
  amount: number;
  previous_balance: number;
  new_balance: number;
  payment_date: string;
  remarks: string | null;
  collector?: ApiCollector;
}

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
  collector_id: number;
  collector: ApiCollector;
  loans: ApiLoan[];
  payments: ApiPayment[];
}

/* ── Route ───────────────────────────────────────────────────────────────── */

export const Route = createFileRoute("/_app/clients/$clientId")({
  component: ClientDetail,
});

/* ── Page ────────────────────────────────────────────────────────────────── */

function ClientDetail() {
  const { clientId } = useParams({ from: "/_app/clients/$clientId" });
  const { token }    = useRole();
  const navigate     = useNavigate();

  const [client,  setClient]  = useState<ApiClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloanOpen, setReloanOpen] = useState(false);

  const fetchClient = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<ApiClient>("GET", `clients/${clientId}`, { token });
      setClient(data);
    } catch {
      toast.error("Failed to load client.");
    } finally {
      setLoading(false);
    }
  }, [token, clientId]);

  useEffect(() => { fetchClient(); }, [fetchClient]);

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/clients"><ArrowLeft className="mr-1 h-4 w-4" />Back to clients</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Client not found.</p>
      </div>
    );
  }

  const allLoans   = [...client.loans].sort((a, b) => b.id - a.id);
  const activeLoan = allLoans.find((l) => l.status !== "paid") ?? null;
  const schedule   = activeLoan?.schedule_rows ?? [];
  const pctPaid    = activeLoan
    ? Math.round(100 - (activeLoan.current_balance / activeLoan.total_receivable) * 100)
    : 0;

  function handleReloanCreated() {
    setReloanOpen(false);
    navigate({ to: "/loans", search: { clientId: client!.id } });
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/clients"><ArrowLeft className="mr-1 h-4 w-4" />Back to clients</Link>
        </Button>
        <Button
          onClick={() => setReloanOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary-glow"
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />New Reloan
        </Button>
      </div>

      <PageHeader
        title={client.name}
        subtitle={`${client.number} · ${client.store_name}`}
        actions={<StatusBadge status={client.status} />}
      />

      {/* Cards row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Client info */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="font-display text-sm font-semibold">Client information</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <InfoRow icon={Store}  label="Store"    >{client.store_name}</InfoRow>
            <InfoRow icon={MapPin} label="Address"  >{client.address}</InfoRow>
            <InfoRow icon={Phone}  label="Phone"    >{client.phone}</InfoRow>
            <KV label="Type"      ><StatusBadge status={client.type} /></KV>
            <KV label="Collector" ><span className="font-medium">{client.collector?.name ?? "—"}</span></KV>
            <KV label="Total loans"><span className="font-medium">{allLoans.length}</span></KV>
          </dl>
        </div>

        {/* Active loan summary */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h3 className="font-display text-sm font-semibold">
            {activeLoan ? "Active loan" : "Loan summary"}
          </h3>
          {activeLoan ? (
            <div className="mt-4 space-y-2.5 text-sm">
              <KV label="Loan #"       ><span className="font-mono text-xs">{activeLoan.number}</span></KV>
              <KV label="Type"         ><span>{LOAN_TYPE_LABELS[activeLoan.loan_type as keyof typeof LOAN_TYPE_LABELS] ?? activeLoan.loan_type}</span></KV>
              <KV label="Principal"    ><span>{formatPHP(activeLoan.principal)}</span></KV>
              <KV label="Interest"     ><span>{formatPHP(activeLoan.interest)}</span></KV>
              <KV label="Total payable"><span className="font-semibold">{formatPHP(activeLoan.total_receivable)}</span></KV>
              <KV label="Daily payment"><span>{formatPHP(activeLoan.daily_payment)}</span></KV>
              <KV label="Released"     ><span>{formatDate(activeLoan.release_date)}</span></KV>
              <KV label="Due date"     ><span>{formatDate(activeLoan.due_date)}</span></KV>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No active loan.</p>
          )}
        </div>

        {/* Balance */}
        <div className="rounded-2xl border bg-linear-to-br from-primary to-primary-glow p-5 text-primary-foreground shadow-sm">
          <p className="text-xs uppercase tracking-wider opacity-80">Outstanding balance</p>
          <p className="mt-1 font-display text-3xl font-semibold num">
            {activeLoan ? formatPHP(activeLoan.current_balance) : "—"}
          </p>
          {activeLoan && (
            <>
              <div className="mt-4 h-2 rounded-full bg-primary-foreground/20">
                <div className="h-2 rounded-full bg-primary-foreground" style={{ width: `${pctPaid}%` }} />
              </div>
              <p className="mt-3 text-xs opacity-80">{pctPaid}% collected</p>
            </>
          )}
          <Button
            variant="secondary"
            className="mt-5 w-full"
            onClick={() => setReloanOpen(true)}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />New Reloan
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="loans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="loans">Loan history ({allLoans.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({client.payments.length})</TabsTrigger>
          {activeLoan && <TabsTrigger value="schedule">Schedule</TabsTrigger>}
        </TabsList>

        {/* Loan history */}
        <TabsContent value="loans">
          <div className="rounded-2xl border bg-card shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Loan #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLoans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      No loans yet.
                    </TableCell>
                  </TableRow>
                ) : allLoans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-[11px]">{l.number}</TableCell>
                    <TableCell className="text-xs">
                      {LOAN_TYPE_LABELS[l.loan_type as keyof typeof LOAN_TYPE_LABELS] ?? l.loan_type}
                    </TableCell>
                    <TableCell className="text-right num text-sm">{formatPHP(l.principal)}</TableCell>
                    <TableCell className="text-right num text-sm">{formatPHP(l.total_receivable)}</TableCell>
                    <TableCell className="text-right num text-sm font-semibold">{formatPHP(l.current_balance)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(l.release_date)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(l.due_date)}</TableCell>
                    <TableCell><StatusBadge status={l.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Payment history */}
        <TabsContent value="payments">
          <div className="rounded-2xl border bg-card shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Previous</TableHead>
                  <TableHead className="text-right">New balance</TableHead>
                  <TableHead>Collector</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No payments yet.
                    </TableCell>
                  </TableRow>
                ) : client.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(p.payment_date)}</TableCell>
                    <TableCell className="text-right num font-medium">{formatPHP(p.amount)}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">{formatPHP(p.previous_balance)}</TableCell>
                    <TableCell className="text-right num">{formatPHP(p.new_balance)}</TableCell>
                    <TableCell className="text-xs">{p.collector?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.remarks ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Schedule */}
        {activeLoan && (
          <TabsContent value="schedule">
            <div className="rounded-2xl border bg-card shadow-sm overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No schedule rows.
                      </TableCell>
                    </TableRow>
                  ) : schedule.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(s.scheduled_date)}</TableCell>
                      <TableCell className="text-right num">{formatPHP(s.expected)}</TableCell>
                      <TableCell className="text-right num">{formatPHP(s.actual)}</TableCell>
                      <TableCell className="text-right num">{formatPHP(s.balance_after)}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <ReloanDialog
        open={reloanOpen}
        onClose={() => setReloanOpen(false)}
        client={client}
        token={token}
        defaultPrincipal={activeLoan?.principal ?? 10000}
        onCreated={handleReloanCreated}
      />
    </div>
  );
}

/* ── Reloan Dialog ───────────────────────────────────────────────────────── */

const TERM_OPTIONS = [30, 45, 60] as const;
type TermOption = typeof TERM_OPTIONS[number];

function ReloanDialog({
  open, onClose, client, token, defaultPrincipal, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  client: ApiClient;
  token: string | null;
  defaultPrincipal: number;
  onCreated: () => void;
}) {
  const [principal,    setPrincipal]    = useState(defaultPrincipal);
  const [termDays,     setTermDays]     = useState<TermOption>(60);
  const [date,         setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [holidayCount, setHolidayCount] = useState(0);
  const [saving,       setSaving]       = useState(false);
  const [scRate,       setScRate]       = useState(0);
  const [holidays,     setHolidays]     = useState<string[]>([]);
  const [settingsReady, setSettingsReady] = useState(false);

  // Load settings once when dialog first opens
  useEffect(() => {
    if (!open || !token || settingsReady) return;
    apiRequest<ApiSetting[]>("GET", "settings", { token })
      .then((data) => {
        const m = Object.fromEntries(data.map((s) => [s.key, s.value ?? ""]));
        setScRate(parseFloat(m.default_service_charge ?? "0") || 0);
        const stored = parseInt(m.default_loan_term ?? "60", 10);
        if ((TERM_OPTIONS as readonly number[]).includes(stored)) setTermDays(stored as TermOption);
        try {
          const h = JSON.parse(m.holidays ?? "[]");
          if (Array.isArray(h))
            setHolidays(h.map((x: { date?: string } | string) => (typeof x === "string" ? x : (x.date ?? ""))).filter(Boolean));
        } catch { /* keep empty */ }
        setSettingsReady(true);
      })
      .catch(() => {});
  }, [open, token, settingsReady]);

  // Reset principal when the dialog opens for a new client/loan
  useEffect(() => {
    if (open) setPrincipal(defaultPrincipal);
  }, [open, defaultPrincipal]);

  const interest        = calcInterest(principal, termDays);
  const sc              = calcServiceCharge(principal, scRate);
  const totalReceivable = principal + interest;
  const daily           = calcDailyPayment(totalReceivable, termDays);
  const dueDate         = date ? addDays(date, termDays + holidayCount) : null;

  async function handleSubmit() {
    if (!token || principal <= 0) return;
    setSaving(true);
    try {
      await apiRequest("POST", "loans", {
        token,
        body: {
          client_id:      client.id,
          loan_type:      "reloan",
          principal,
          interest,
          service_charge: sc,
          daily_payment:  daily,
          term_days:      termDays,
          holiday_count:  holidayCount,
          release_date:   date,
        },
      });
      toast.success("Reloan created", {
        description: `${client.name} — ₱${principal.toLocaleString()} · ${termDays} days`,
      });
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create reloan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Reloan</DialogTitle>
          <p className="text-xs text-muted-foreground">{client.name} · {client.store_name}</p>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* Principal */}
          <div className="space-y-1.5">
            <Label className="text-xs">Principal amount (₱)</Label>
            <Input
              type="number"
              min={1}
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value) || 0)}
              autoFocus
            />
          </div>

          {/* Term */}
          <div className="space-y-1.5">
            <Label className="text-xs">Loan term</Label>
            <Select value={String(termDays)} onValueChange={(v) => setTermDays(Number(v) as TermOption)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TERM_OPTIONS.map((t) => (
                  <SelectItem key={t} value={String(t)}>{t} days</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Release date */}
          <div className="space-y-1.5">
            <Label className="text-xs">Release date</Label>
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* Holidays within term */}
          <div className="space-y-1.5">
            <Label className="text-xs">Holidays within term</Label>
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
          </div>

          {/* Live calculation */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
            <CalcRow label="Interest"       value={formatPHP(interest)} />
            {sc > 0 && <CalcRow label="Processing fee" value={formatPHP(sc)} />}
            <div className="border-t pt-2 space-y-2">
              <CalcRow label="Total payable"  value={formatPHP(totalReceivable)} bold />
              <CalcRow label="Daily payment"  value={formatPHP(daily)} bold accent />
              {dueDate && <CalcRow label="Due date" value={formatDate(dueDate)} />}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || principal <= 0}
            className="bg-primary text-primary-foreground hover:bg-primary-glow"
          >
            {saving
              ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              : <RefreshCw className="mr-1.5 h-4 w-4" />}
            {saving ? "Creating…" : "Create reloan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Small helpers ───────────────────────────────────────────────────────── */

function InfoRow({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{children}</p>
      </div>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="num">{children}</span>
    </div>
  );
}

function CalcRow({ label, value, bold, accent }: {
  label: string; value: string; bold?: boolean; accent?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num ${bold ? "font-semibold" : ""} ${accent ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}
