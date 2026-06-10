import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/finance/PageHeader";
import { LoanCreateSection, type ApiLoan } from "@/components/loans/LoanCreateSection";
import { ActiveLoanTable } from "@/components/loans/ActiveLoanTable";
import { PendingLoansSection } from "@/components/loans/PendingLoansSection";
import { apiRequest } from "@/lib/api";
import { useRole } from "@/lib/role-context";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/shared/AccessRestricted";

export const Route = createFileRoute("/_app/loans")({
  validateSearch: (search: Record<string, unknown>) => ({
    clientId: typeof search.clientId === "number" ? (search.clientId as number) : undefined,
  }),
  head: () => ({ meta: [{ title: "Loans — BuenaMano" }] }),
  component: LoansPage,
});

function LoansPage() {
  const { token } = useRole();
  const { clientId: initialClientId } = Route.useSearch();
  const [loans, setLoans]     = useState<ApiLoan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLoans = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<ApiLoan[]>("GET", "loans", { token });
      setLoans(data);
    } catch {
      toast.error("Failed to load loans.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  function handleLoanCreated(loan: ApiLoan) {
    setLoans((prev) => [loan, ...prev]);
  }

  function handlePendingChanged(updated: ApiLoan[], removedId?: number) {
    setLoans((prev) => {
      let next = prev;
      if (removedId !== undefined) {
        next = next.filter((l) => l.id !== removedId);
      }
      for (const u of updated) {
        const idx = next.findIndex((l) => l.id === u.id);
        if (idx >= 0) {
          next = [...next.slice(0, idx), u, ...next.slice(idx + 1)];
        }
      }
      return next;
    });
  }

  function handleReconstructed(oldLoanId: number, newLoan: ApiLoan) {
    setLoans((prev) => {
      const updated = prev.map((l) =>
        l.id === oldLoanId ? { ...l, status: "paid" } : l
      );
      return [newLoan, ...updated];
    });
  }

  function handleLoanUpdated(updated: ApiLoan) {
    setLoans((prev) => prev.map((l) => l.id === updated.id ? updated : l));
  }

  const pendingLoans = loans.filter((l) => l.status === "pending");
  const activeLoans  = loans.filter((l) => l.status !== "pending");

  return (
    <PermissionGuard permission="loans:read">
    <div className="space-y-6">
      <PageHeader title="Loan management" subtitle="Encode new loans and review the active loan ledger." />
      <LoanCreateSection token={token} onLoanCreated={handleLoanCreated} initialClientId={initialClientId} />
      <PendingLoansSection token={token} loans={pendingLoans} onLoansChanged={handlePendingChanged} />
      <ActiveLoanTable loans={activeLoans} loading={loading} onReconstructed={handleReconstructed} onLoanUpdated={handleLoanUpdated} />
    </div>
    </PermissionGuard>
  );
}
