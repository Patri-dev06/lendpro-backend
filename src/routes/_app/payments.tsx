import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/finance/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccessRestricted } from "@/components/payments/AccessRestricted";
import { PermissionGuard } from "@/components/shared/AccessRestricted";
import { DirectInputTab } from "@/components/payments/DirectInputTab";
import { UploadExcelTab } from "@/components/payments/UploadExcelTab";

const VALID_TABS = ["direct", "upload"] as const;
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
        subtitle="Record daily collections and upload Excel files for batch payment processing."
      />
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="direct">Direct Input</TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-1.5">
            Upload Excel
            {!isClerk && <Lock className="h-3 w-3 opacity-50" />}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="direct" className="mt-5"><DirectInputTab /></TabsContent>
        <TabsContent value="upload" className="mt-5">
          {isClerk ? <UploadExcelTab /> : <AccessRestricted />}
        </TabsContent>
      </Tabs>
    </div>
    </PermissionGuard>
  );
}
