import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle, Download, FileSpreadsheet, Info,
  Loader2, Upload, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/lib/role-context";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api";

interface Collector { id: number; name: string; area: string; }
interface LoanRow {
  number: string;
  status: string;
  daily_payment: number;
  client: { name: string; store_name: string };
  collector?: { id: number; name: string } | null;
}

export function UploadExcelTab() {
  const { token } = useRole();

  // ── Template generation state ──────────────────────────────────────────
  const [collectors, setCollectors]     = useState<Collector[]>([]);
  const [selectedId, setSelectedId]     = useState<string>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [templateDate, setTemplateDate] = useState(new Date().toISOString().slice(0, 10));
  const [generating, setGenerating]     = useState(false);

  // ── Upload state ───────────────────────────────────────────────────────
  const [file, setFile]       = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]   = useState<{ imported: number; errors: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchCollectors = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<Collector[]>("GET", "collectors", { token });
      setCollectors(data);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { fetchCollectors(); }, [fetchCollectors]);

  // ── Template download ──────────────────────────────────────────────────
  const areas = [...new Set(collectors.map((c) => c.area).filter(Boolean))].sort();

  function handleCollectorChange(v: string) {
    setSelectedId(v);
    if (v !== "all") setSelectedArea("all");
  }

  function handleAreaChange(v: string) {
    setSelectedArea(v);
    if (v !== "all") setSelectedId("all");
  }

  async function handleDownloadTemplate() {
    if (!token) return;
    setGenerating(true);
    try {
      const loans  = await apiRequest<LoanRow[]>("GET", "loans", { token });
      const unpaid = loans.filter((l) => l.status !== "paid");

      const collectorAreaMap = new Map(collectors.map((c) => [c.id, c.area]));

      const filtered =
        selectedArea !== "all"
          ? unpaid.filter((l) => l.collector && collectorAreaMap.get(l.collector.id) === selectedArea)
          : selectedId === "all"
            ? unpaid
            : unpaid.filter((l) => l.collector?.id === Number(selectedId));

      if (filtered.length === 0) {
        toast.error("No active loans found for the selected filter.");
        return;
      }

      const esc = (v: string | number) => {
        const s = String(v ?? "");
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };
      const row = (...cells: (string | number)[]) => cells.map(esc).join(",");

      const filenameLabel =
        selectedArea !== "all"
          ? `Area - ${selectedArea}`
          : collectors.find((c) => c.id === Number(selectedId))?.name ?? "All Collectors";

      const lines: string[] = [];
      lines.push(row(
        "loan_number", "payment_date", "amount", "remarks",
        "── REFERENCE ONLY (do not delete columns above) ──",
        "client_name", "store_name", "daily_payment",
      ));

      for (const l of filtered) {
        lines.push(row(
          l.number,
          templateDate,
          l.daily_payment,
          "",
          "",
          l.client.name,
          l.client.store_name,
          l.daily_payment,
        ));
      }

      const csv  = lines.join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `Collection Template - ${filenameLabel} - ${templateDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Template downloaded — ${filtered.length} loan${filtered.length !== 1 ? "s" : ""} included.`);
    } catch {
      toast.error("Failed to generate template.");
    } finally {
      setGenerating(false);
    }
  }

  // ── File upload ────────────────────────────────────────────────────────
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls") && !f.name.endsWith(".csv")) {
      toast.error("Please upload an Excel (.xlsx, .xls) or CSV file.");
      return;
    }
    setFile(f);
    setResult(null);
  }

  function handleRemove() {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleImport() {
    if (!file || !token) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_URL}/payments/upload`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        body:    form,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.message ??
          (data?.errors ? Object.values(data.errors as Record<string, string[]>)[0]?.[0] : null) ??
          "Upload failed.";
        toast.error(msg);
        return;
      }

      setResult(data);
      toast.success(`${data.imported} payment${data.imported !== 1 ? "s" : ""} imported successfully.`);
      handleRemove();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Step 1 — Download Template */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
            <h3 className="font-display text-base font-semibold">Download Collection Template</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground pl-8">
            Generate a pre-filled spreadsheet with today's loans. Fill in the <strong>amount</strong> column for each client who paid, then delete rows for clients who didn't pay.
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Collector</Label>
              <Select value={selectedId} onValueChange={handleCollectorChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select collector…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Collectors</SelectItem>
                  {collectors.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}{c.area ? ` — ${c.area}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Area</Label>
              <Select value={selectedArea} onValueChange={handleAreaChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select area…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {areas.map((area) => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Collection Date</Label>
              <input
                type="date"
                value={templateDate}
                onChange={(e) => setTemplateDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Column guide */}
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-xs space-y-1.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
              Template columns
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground">
              <span><span className="font-mono font-semibold text-foreground">loan_number</span> — auto-filled, do not edit</span>
              <span><span className="font-mono font-semibold text-foreground">payment_date</span> — auto-filled, change if needed</span>
              <span><span className="font-mono font-semibold text-foreground">amount</span> — pre-filled with daily payment, edit if partial</span>
              <span><span className="font-mono font-semibold text-foreground">remarks</span> — optional notes</span>
            </div>
            <p className="text-muted-foreground pt-0.5">
              Columns to the right of <span className="font-mono">remarks</span> are reference-only and are ignored on upload.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleDownloadTemplate} disabled={generating} className="w-full sm:w-auto">
              {generating
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Download className="mr-2 h-4 w-4" />}
              {generating ? "Generating…" : "Download Template"}
            </Button>
          </div>
        </div>
      </div>

      {/* Step 2 — Upload Completed File */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
            <h3 className="font-display text-base font-semibold">Upload Completed File</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground pl-8">
            Upload the filled-in spreadsheet to record all payments at once.
          </p>
        </div>

        <div className="px-5 py-5 space-y-4">
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />

          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium">Click to choose a file</p>
                <p className="text-xs text-muted-foreground mt-0.5">.xlsx, .xls, or .csv</p>
              </div>
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-success shrink-0" />
                <div>
                  <p className="text-sm font-medium text-success">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleRemove}>
                Remove
              </Button>
            </div>
          )}

          {file && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleRemove} disabled={uploading}>
                Remove file
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary-glow"
                onClick={handleImport}
                disabled={uploading}
              >
                {uploading
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Upload className="mr-2 h-4 w-4" />}
                {uploading ? "Importing…" : "Import payments"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Import result */}
      {result && (
        <div className="space-y-3">
          {result.imported > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
              <CheckCircle className="h-5 w-5 text-success shrink-0" />
              <p className="text-sm font-medium text-success">
                {result.imported} payment{result.imported !== 1 ? "s" : ""} imported successfully.
              </p>
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm font-medium text-destructive">
                  {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} had errors:
                </p>
              </div>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-destructive">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
