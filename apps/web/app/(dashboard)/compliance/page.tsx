import { ShieldCheck } from "lucide-react";
import { ModulePlaceholder } from "@/components/templates/ModulePlaceholder";

export default function CompliancePage() {
  return (
    <ModulePlaceholder
      icon={ShieldCheck}
      title="ComplianceRadar is coming soon"
      description="FIRS, CAC, PAYE, PENCOM, and NSITF deadline tracking ships in a later phase."
    />
  );
}
