import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PaymentConnectorsCard } from "@/components/modules/PaymentConnectorsCard";
import { AccountingConnectorsCard } from "@/components/modules/AccountingConnectorsCard";

// F-connectors — a business that already uses QuickBooks, Xero, or a
// third-party payroll provider shouldn't have to abandon it to use Vela.
// Payment (PaymentConnectorsCard) and accounting (AccountingConnectorsCard)
// connections have both shipped; a payroll-provider connector is next on
// the backlog and lands here once built.
export default function IntegrationsSettingsPage() {
  return (
    <SettingsTemplate activePath="/settings/integrations">
      <div className="flex flex-col gap-4">
        <PaymentConnectorsCard />
        <AccountingConnectorsCard />

        <Card>
          <CardHeader>
            <CardTitle>Payroll</CardTitle>
          </CardHeader>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Connecting an existing third-party payroll provider is coming soon.
          </p>
        </Card>
      </div>
    </SettingsTemplate>
  );
}
