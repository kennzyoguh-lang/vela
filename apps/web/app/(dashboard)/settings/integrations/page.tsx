import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { PaymentConnectorsCard } from "@/components/modules/PaymentConnectorsCard";
import { AccountingConnectorsCard } from "@/components/modules/AccountingConnectorsCard";
import { PayrollExportCard } from "@/components/modules/PayrollExportCard";

// F-connectors — a business that already uses QuickBooks, Xero, or a
// third-party payroll provider shouldn't have to abandon it to use Vela.
// All three connectors (payment, accounting, payroll) have shipped.
export default function IntegrationsSettingsPage() {
  return (
    <SettingsTemplate activePath="/settings/integrations">
      <div className="flex flex-col gap-4">
        <PaymentConnectorsCard />
        <AccountingConnectorsCard />
        <PayrollExportCard />
      </div>
    </SettingsTemplate>
  );
}
