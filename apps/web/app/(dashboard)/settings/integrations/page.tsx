import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PaymentConnectorsCard } from "@/components/modules/PaymentConnectorsCard";

// F-connectors — a business that already uses QuickBooks, Xero, or a
// third-party payroll provider shouldn't have to abandon it to use Vela.
// Payment processor connections ship first (PaymentConnectorsCard);
// accounting-app and payroll-app connectors need an OAuth app registered
// with each provider (a real account-setup step, not something buildable
// without it) and land here once that's in place.
export default function IntegrationsSettingsPage() {
  return (
    <SettingsTemplate activePath="/settings/integrations">
      <div className="flex flex-col gap-4">
        <PaymentConnectorsCard />

        <Card>
          <CardHeader>
            <CardTitle>Accounting &amp; payroll</CardTitle>
          </CardHeader>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Connecting an existing QuickBooks, Xero, or payroll provider account is coming soon.
          </p>
        </Card>
      </div>
    </SettingsTemplate>
  );
}
