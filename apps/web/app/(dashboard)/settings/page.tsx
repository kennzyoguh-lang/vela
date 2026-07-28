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
          Organisation profile editing (name, industry, base currency, compliance bodies) ships
          alongside ComplianceRadar — Foundation establishes the Settings shell these forms will
          live in.
        </p>
      </Card>
    </SettingsTemplate>
  );
}
