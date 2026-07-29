import type { Employee } from "@vela/types";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format";

// One employee per card, never a table row pretending to be one (Card's 4.8
// rule) — same precedent as every other module's card component.
export function EmployeeCard({ employee }: { employee: Employee }) {
  const grossPay =
    parseFloat(employee.basicSalary) +
    parseFloat(employee.housingAllowance) +
    parseFloat(employee.transportAllowance) +
    parseFloat(employee.otherAllowances);

  return (
    <Card className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-ui text-text-primary truncate text-[0.875rem] font-semibold">
          {employee.name}
        </p>
        <p className="text-text-secondary mt-1 text-[0.75rem]">{employee.jobTitle}</p>
      </div>
      <p className="font-ui text-text-primary shrink-0 text-[0.875rem] font-bold">
        {formatMoney(grossPay, "NGN")}/mo
      </p>
    </Card>
  );
}
