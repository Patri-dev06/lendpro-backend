import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Lock } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/finance/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccessRestricted } from "@/components/payments/AccessRestricted";
import { PermissionGuard } from "@/components/shared/AccessRestricted";
import { DirectInputTab } from "@/components/payments/DirectInputTab";
import { UploadExcelTab } from "@/components/payments/UploadExcelTab";
import { CollectorSummaryTab } from "@/components/payments/CollectorSummaryTab";
import { ClientLedgerTab } from "@/components/payments/ClientLedgerTab";
import { CollectionSheetDialog } from "@/components/payments/CollectionSheetDialog";

const VALID_TABS = ["direct", "upload", "summary", "ledger"] as const;
type TabValue = (typeof VALID_TABS)[number];

export const Route = createFileRoute("/_app/payments")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (VALID_TABS.includes(search.tab as TabValue) ? search.tab : "direct") as TabValue,
  }),
  head: () => ({ meta: [{ title: "Payments — BuenaMano" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { role } = useRole();
  const { tab: initialTab } = Route.useSearch();
  const isClerk = hasPermission(role, "payments:write");
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  return (
    <PermissionGuard permission="payments:read">
    <div className="space-y-6">
      <PageHeader
        title="Payments & Collections"
        subtitle="Record daily collections, upload Excel files, and view collector summary reports."
        actions={(activeTab === "direct" || activeTab === "upload") ? <CollectionSheetDialog /> : undefined}
      />
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="direct">Direct Input</TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-1.5">
            Upload Excel
            {!isClerk && <Lock className="h-3 w-3 opacity-50" />}
          </TabsTrigger>
          <TabsTrigger value="summary">Collector Summary</TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />Client Ledger
          </TabsTrigger>
        </TabsList>
        <TabsContent value="direct" className="mt-5"><DirectInputTab /></TabsContent>
        <TabsContent value="upload" className="mt-5">
          {isClerk ? <UploadExcelTab /> : <AccessRestricted />}
        </TabsContent>
        <TabsContent value="summary" className="mt-5"><CollectorSummaryTab /></TabsContent>
        <TabsContent value="ledger" className="mt-5"><ClientLedgerTab /></TabsContent>
      </Tabs>
    </div>
    </PermissionGuard>
  );
}
