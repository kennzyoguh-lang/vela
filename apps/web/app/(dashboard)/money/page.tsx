import { LineChart } from "lucide-react";
import { ModulePlaceholder } from "@/components/templates/ModulePlaceholder";

export default function MoneyPage() {
  return (
    <ModulePlaceholder
      icon={LineChart}
      title="P&L Intelligence is coming soon"
      description="Bank sync, reconciliation, and automated P&L reports ship in a later phase."
    />
  );
}
