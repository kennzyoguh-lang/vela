"use client";

import { useState } from "react";
import type { Payslip } from "@vela/types";
import { formatMoney } from "@/lib/format";
import { openAuthenticatedPdf, ApiError } from "@/lib/api/client";

export function PayslipRow({
  payslip,
  employeeName,
  employeeJobTitle,
}: {
  payslip: Payslip;
  employeeName: string;
  employeeJobTitle: string;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setError(null);
    try {
      await openAuthenticatedPdf(
        `/v1/payroll-runs/${payslip.payrollRunId}/payslips/${payslip.id}/pdf`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't open the payslip.");
    }
  }

  return (
    <div className="border-border flex items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="font-ui text-text-primary truncate text-[0.875rem] font-semibold">
          {employeeName}
        </p>
        <p className="text-text-secondary text-[0.75rem]">{employeeJobTitle}</p>
        {error ? <p className="text-status-danger text-[0.75rem]">{error}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-ui text-text-primary text-[0.875rem] font-bold">
          {formatMoney(payslip.netPay, "NGN")}
        </p>
        <p className="text-text-secondary text-[0.75rem]">
          Gross {formatMoney(payslip.grossPay, "NGN")}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="text-data-aiAccent -m-2 shrink-0 p-2 text-[0.75rem] hover:underline"
      >
        Download payslip
      </button>
    </div>
  );
}
