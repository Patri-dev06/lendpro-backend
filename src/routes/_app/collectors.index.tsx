import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Download, Plus, Pencil, Trash2, Loader2, Search, Phone, MapPin } from "lucide-react";
import { PageHeader } from "@/components/finance/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { formatPHP } from "@/lib/format";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/shared/AccessRestricted";

interface Collector {
  id: number;
  name: string;
  code: string;
  area: string;
  phone: string | null;
  address: string | null;
  mothers_name: string | null;
  fathers_name: string | null;
  place_of_birth: string | null;
  date_of_birth: string | null;
  fb_messenger: string | null;
  email: string | null;
  drivers_license: string | null;
  assigned: number;
  expected: number;
  actual: number;
  missed: number;
  overdue: number;
  past_due: number;
}

export const Route = createFileRoute("/_app/collectors/")({
  head: () => ({ meta: [{ title: "Collectors — BuenaMano" }] }),
  component: CollectorsPage,
});

function CollectorsPage() {
  const { token } = useRole();
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading]       = useState(true);
  const [q, setQ]                   = useState("");
  const [addOpen, setAddOpen]       = useState(false);
  const [editTarget, setEditTarget] = useState<Collector | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Collector | null>(null);

  const fetchCollectors = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<Collector[]>("GET", "collectors", { token });
      setCollectors(data);
    } catch {
      toast.error("Failed to load collectors.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchCollectors(); }, [fetchCollectors]);

  function downloadCSV() {
    const today = new Date().toISOString().slice(0, 10);
    const headers = ["ID", "Collector Name", "Area", "Phone", "Assigned", "Expected (₱)", "Actual (₱)", "Rate (%)"];
    const rows = collectors.map((c) => {
      const rate = c.expected > 0 ? Math.round((c.actual / c.expected) * 100) : 0;
      return [c.code, c.name, c.area, c.phone ?? "", c.assigned, c.expected, c.actual, rate].join(",");
    });
    const csv  = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: `collector-summary-${today}.csv` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Collector summary downloaded.");
  }

  async function handleDelete() {
    if (!deleteTarget || !token) return;
    try {
      await apiRequest("DELETE", `collectors/${deleteTarget.id}`, { token });
      setCollectors((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success(`${deleteTarget.name} removed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete collector.");
    } finally {
      setDeleteTarget(null);
    }
  }

  const filtered = collectors.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.code.toLowerCase().includes(q.toLowerCase()) ||
    c.area.toLowerCase().includes(q.toLowerCase()) ||
    (c.phone ?? "").includes(q)
  );

  return (
    <PermissionGuard permission="collectors:read">
    <div className="space-y-6">
      <PageHeader
        title="Collectors"
        subtitle="Field collection team and performance overview."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={downloadCSV} disabled={loading}>
              <Download className="mr-2 h-4 w-4" />Download Summary
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary-glow" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />Add collector
            </Button>
          </div>
        }
      />

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8 h-9 text-sm" placeholder="Search collectors…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-x-auto">
        <Table className="min-w-200">
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Assigned</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <tr><td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">Loading collectors…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                {collectors.length === 0 ? "No collectors yet." : "No results match your search."}
              </td></tr>
            ) : filtered.map((c) => {
              const rate = c.expected > 0 ? Math.round((c.actual / c.expected) * 100) : 0;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.code}</TableCell>
                  <TableCell>
                    <Link
                      to="/collectors/$id"
                      params={{ id: String(c.id) }}
                      className="font-medium hover:text-primary hover:underline underline-offset-4 transition-colors"
                    >
                      {c.name}
                    </Link>
                    {c.address && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-40">{c.address}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{c.area}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />{c.phone}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right num">{c.assigned}</TableCell>
                  <TableCell className="text-right num">{formatPHP(c.expected)}</TableCell>
                  <TableCell className="text-right num">{formatPHP(c.actual)}</TableCell>
                  <TableCell className={`text-right num font-semibold ${rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-destructive"}`}>
                    {rate}%
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditTarget(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CollectorFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        token={token}
        onSaved={(c) => { setCollectors((prev) => [...prev, c]); setAddOpen(false); }}
      />

      <CollectorFormDialog
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        token={token}
        collector={editTarget ?? undefined}
        onSaved={(c) => { setCollectors((prev) => prev.map((x) => x.id === c.id ? c : x)); setEditTarget(null); }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove collector?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code}) from the system. Their assigned clients will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Remove</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PermissionGuard>
  );
}

/* ---------- Form dialog ---------- */
interface FormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  collector?: Collector;
  onSaved: (c: Collector) => void;
}

function CollectorFormDialog({ open, onOpenChange, token, collector, onSaved }: FormDialogProps) {
  const editing = !!collector;

  const [name, setName]             = useState("");
  const [area, setArea]             = useState("");
  const [phone, setPhone]           = useState("");
  const [address, setAddress]       = useState("");
  const [mothersName, setMothersName] = useState("");
  const [fathersName, setFathersName] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [dateOfBirth, setDateOfBirth]   = useState("");
  const [fbMessenger, setFbMessenger]   = useState("");
  const [email, setEmail]           = useState("");
  const [driversLicense, setDriversLicense] = useState("");
  const [saving, setSaving]         = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(collector?.name ?? "");
      setArea(collector?.area ?? "");
      setPhone(collector?.phone?.replace(/^\+?63/, "").replace(/^0/, "") ?? "");
      setAddress(collector?.address ?? "");
      setMothersName(collector?.mothers_name ?? "");
      setFathersName(collector?.fathers_name ?? "");
      setPlaceOfBirth(collector?.place_of_birth ?? "");
      setDateOfBirth(collector?.date_of_birth ?? "");
      setFbMessenger(collector?.fb_messenger ?? "");
      setEmail(collector?.email ?? "");
      setDriversLicense(collector?.drivers_license ?? "");
      setErrors({});
    }
  }, [open, collector]);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim())          e.name         = "Full name is required.";
    if (!area.trim())          e.area         = "Area / route is required.";
    if (!phone.trim())         e.phone        = "Cellphone number is required.";
    else if (phone.replace(/\D/g, "").length !== 10) e.phone = "Enter 10 digits after +63.";
    if (!address.trim())       e.address      = "Address is required.";
    if (!mothersName.trim())   e.mothersName  = "Mother's name is required.";
    if (!fathersName.trim())   e.fathersName  = "Father's name is required.";
    if (!placeOfBirth.trim())  e.placeOfBirth = "Place of birth is required.";
    if (!dateOfBirth)          e.dateOfBirth  = "Date of birth is required.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Invalid email address.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate() || !token) return;
    setSaving(true);
    try {
      const localPhone = "0" + phone.replace(/\D/g, "");
      const body = {
        name:            name.trim(),
        area:            area.trim(),
        phone:           localPhone,
        address:         address.trim(),
        mothers_name:    mothersName.trim(),
        fathers_name:    fathersName.trim(),
        place_of_birth:  placeOfBirth.trim(),
        date_of_birth:   dateOfBirth,
        fb_messenger:    fbMessenger.trim() || null,
        email:           email.trim() || null,
        drivers_license: driversLicense.trim() || null,
      };
      const saved = editing
        ? await apiRequest<Collector>("PATCH", `collectors/${collector!.id}`, { token, body })
        : await apiRequest<Collector>("POST", "collectors", { token, body });
      toast.success(editing ? "Collector updated." : `Collector added — ID: ${saved.code}`);
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit collector — ${collector!.code}` : "Add new collector"}
          </DialogTitle>
          {editing && (
            <p className="text-xs text-muted-foreground">ID is auto-assigned and cannot be changed.</p>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 py-1">

          {/* ── Personal Info ── */}
          <FF label="Full name" error={errors.name} full>
            <Input value={name} onChange={(e) => { setName(e.target.value); clrErr("name"); }}
              placeholder="Maria Santos" disabled={saving} className={errors.name ? "border-destructive" : ""} />
          </FF>

          <FF label="Area / Route" error={errors.area}>
            <Input value={area} onChange={(e) => { setArea(e.target.value); clrErr("area"); }}
              placeholder="Poblacion Zone 1" disabled={saving} className={errors.area ? "border-destructive" : ""} />
          </FF>

          <FF label="Cellphone number" error={errors.phone}>
            <div className={`flex h-9 w-full overflow-hidden rounded-md border bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${errors.phone ? "border-destructive" : "border-input"}`}>
              <span className="flex items-center border-r bg-muted px-3 text-muted-foreground select-none">+63</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s]/g, "")); clrErr("phone"); }}
                placeholder="917 000 0000"
                disabled={saving}
                className="flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </FF>

          <FF label="Email address (optional)" error={errors.email}>
            <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); clrErr("email"); }}
              placeholder="collector@email.com" disabled={saving} className={errors.email ? "border-destructive" : ""} />
          </FF>

          <FF label="Address" error={errors.address} full>
            <Textarea value={address} onChange={(e) => { setAddress(e.target.value); clrErr("address"); }}
              placeholder="House / Unit No., Street, Barangay, City, Province"
              rows={2} disabled={saving} className={errors.address ? "border-destructive" : ""} />
          </FF>

          <FF label="Mother's full name" error={errors.mothersName}>
            <Input value={mothersName} onChange={(e) => { setMothersName(e.target.value); clrErr("mothersName"); }}
              placeholder="Ana Santos" disabled={saving} className={errors.mothersName ? "border-destructive" : ""} />
          </FF>

          <FF label="Father's full name" error={errors.fathersName}>
            <Input value={fathersName} onChange={(e) => { setFathersName(e.target.value); clrErr("fathersName"); }}
              placeholder="Jose Santos" disabled={saving} className={errors.fathersName ? "border-destructive" : ""} />
          </FF>

          <FF label="Place of birth" error={errors.placeOfBirth}>
            <Input value={placeOfBirth} onChange={(e) => { setPlaceOfBirth(e.target.value); clrErr("placeOfBirth"); }}
              placeholder="Buenavista, Agusan del Norte" disabled={saving} className={errors.placeOfBirth ? "border-destructive" : ""} />
          </FF>

          <FF label="Date of birth" error={errors.dateOfBirth}>
            <Input type="date" value={dateOfBirth} onChange={(e) => { setDateOfBirth(e.target.value); clrErr("dateOfBirth"); }}
              disabled={saving} className={errors.dateOfBirth ? "border-destructive" : ""} />
          </FF>

          <FF label="FB Messenger (optional)">
            <Input value={fbMessenger} onChange={(e) => setFbMessenger(e.target.value)}
              placeholder="facebook.com/username" disabled={saving} />
          </FF>

          <FF label="Driver's License No. (optional)">
            <Input value={driversLicense} onChange={(e) => setDriversLicense(e.target.value)}
              placeholder="N01-00-000000" disabled={saving} className="uppercase" />
          </FF>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary-glow" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Add collector"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  function clrErr(key: string) {
    setErrors((x) => ({ ...x, [key]: "" }));
  }
}

function FF({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
