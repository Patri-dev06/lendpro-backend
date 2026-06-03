import { useState, useEffect, useCallback } from "react";
import { Printer, FileSpreadsheet, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { printCollectionSheet, exportCollectionSheetCsv, type CollectionLoan } from "@/lib/loan-prints";
import { toast } from "sonner";

interface Collector {
  id: number;
  name: string;
  area: string;
}

interface Settings {
  companyName: string;
  companyAddr: string;
}

export function CollectionSheetDialog() {
  const { token } = useRole();
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [acting, setActing]         = useState(false);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loans, setLoans]           = useState<CollectionLoan[]>([]);
  const [settings, setSettings]     = useState<Settings>({ companyName: "", companyAddr: "" });
  const [selectedId, setSelectedId] = useState<string>("all");

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [fetchedLoans, fetchedCollectors, rawSettings] = await Promise.all([
        apiRequest<CollectionLoan[]>("GET", "loans", { token }),
        apiRequest<Collector[]>("GET", "collectors", { token }),
        apiRequest<{ key: string; value: string | null }[]>("GET", "settings", { token }),
      ]);
      const smap = Object.fromEntries(rawSettings.map((s) => [s.key, s.value ?? ""]));
      setLoans(fetchedLoans.filter((l) => l.status !== "paid"));
      setCollectors(fetchedCollectors);
      setSettings({
        companyName: smap.company_name || "BuenaMano Lending Corporation",
        companyAddr: smap.company_address || "Bonaguit Street, Purok 4, Poblacion 2, Buenavista, Agusan del Norte",
      });
    } catch {
      toast.error("Failed to load collection data.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) {
      setSelectedId("all");
      loadData();
    }
  }, [open, loadData]);

  const filteredLoans = selectedId === "all"
    ? loans
    : loans.filter((l) => l.collector?.id === Number(selectedId));

  const active  = filteredLoans.filter((l) => !["overdue", "past-due"].includes(l.status));
  const pastDue = filteredLoans.filter((l) => ["overdue", "past-due"].includes(l.status));
  const selectedCollector = collectors.find((c) => c.id === Number(selectedId));

  const handlePrint = async () => {
    setActing(true);
    try {
      printCollectionSheet(filteredLoans, settings.companyName, settings.companyAddr);
      setOpen(false);
    } finally {
      setActing(false);
    }
  };

  const handleExcel = async () => {
    setActing(true);
    try {
      const hint = selectedCollector ? selectedCollector.name : "All Collectors";
      exportCollectionSheetCsv(filteredLoans, settings.companyName, settings.companyAddr, hint);
      setOpen(false);
    } finally {
      setActing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Printer className="mr-2 h-4 w-4" />
          Collection Sheet
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Collection Sheet</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Collector</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
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

            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm space-y-1.5">
              {selectedCollector && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Area</span>
                  <span className="font-medium">{selectedCollector.area || "—"}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active clients</span>
                <span className="font-medium text-green-700">{active.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Past due / Overdue</span>
                <span className="font-medium text-red-600">{pastDue.length}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 mt-1">
                <span className="text-muted-foreground">Total loans</span>
                <span className="font-semibold">{filteredLoans.length}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleExcel}
                disabled={acting || filteredLoans.length === 0}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
              <Button
                className="flex-1"
                onClick={handlePrint}
                disabled={acting || filteredLoans.length === 0}
              >
                {acting
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Printer className="mr-2 h-4 w-4" />}
                Print PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
