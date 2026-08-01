import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

export default function OrganisationSettingsPage() {
  return (
    <SettingsTemplate activePath="/settings">
      <Card>
        <CardHeader>
          <CardTitle>Organisation</CardTitle>
        </CardHeader>
        <p className="font-ui text-text-secondary text-[0.875rem]">
          Editing your organisation's name, industry, base currency, and compliance bodies is coming
          soon.
        </p>
      </Card>
    </SettingsTemplate>
  );
}
