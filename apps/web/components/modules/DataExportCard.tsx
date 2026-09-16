"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { downloadAuthenticatedFile, ApiError } from "@/lib/api/client";

// F-63 — NDPR right-to-portability. Owner/Admin only (enforced server-side
// by the route's requireRole, not just hidden here) since this is a
// full-org data operation.
export function DataExportCard() {
  const [downloaded, setDownloaded] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const filename = `vela-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      return downloadAuthenticatedFile("/v1/data-export", filename);
    },
    onSuccess: () => setDownloaded(true),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export your data</CardTitle>
      </CardHeader>
      <p className="font-ui text-text-secondary text-[0.875rem]">
        Download every record VELA holds for your organisation — clients, invoices, employees,
        payroll runs, compliance filings, bank transactions, sales, and products — as a single JSON
        file.
      </p>
      <Button
        variant="secondary"
        loading={mutation.isPending}
        onClick={() => {
          setDownloaded(false);
          mutation.mutate();
        }}
        className="mt-3 self-start"
      >
        Download my data
      </Button>
      {mutation.isError ? (
        <Alert
          variant="danger"
          title={
            mutation.error instanceof ApiError
              ? mutation.error.message
              : "Couldn't prepare your export"
          }
        />
      ) : null}
      {downloaded ? <Alert variant="info" title="Export downloaded" /> : null}
    </Card>
  );
}
