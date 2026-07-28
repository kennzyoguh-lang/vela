import { FileText } from "lucide-react";
import { ModulePlaceholder } from "@/components/templates/ModulePlaceholder";

export default function InvoicesPage() {
  return (
    <ModulePlaceholder
      icon={FileText}
      title="SmartInvoice is coming soon"
      description="Invoice creation, AI risk scoring, and the Pay Now link ship in a later phase — this nav entry is wired for it now."
    />
  );
}
