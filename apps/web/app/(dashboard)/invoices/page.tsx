"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Client, Invoice, InvoiceStatus } from "@vela/types";
import { ListTemplate } from "@/components/templates/ListTemplate";
import { InvoiceCard } from "@/components/modules/InvoiceCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { invoiceStatusLabel } from "@/lib/invoice-status";
import { api } from "@/lib/api/client";

const FILTERS: { label: string; value: InvoiceStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: invoiceStatusLabel("draft"), value: "draft" },
  { label: invoiceStatusLabel("sent"), value: "sent" },
  { label: invoiceStatusLabel("partially_paid"), value: "partially_paid" },
  { label: invoiceStatusLabel("overdue"), value: "overdue" },
  { label: invoiceStatusLabel("paid"), value: "paid" },
];

export default function InvoicesPage() {
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", status],
    queryFn: () => api.get<Invoice[]>(`/v1/invoices${status === "all" ? "" : `?status=${status}`}`),
    staleTime: 30_000,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<Client[]>("/v1/clients"),
    staleTime: 5 * 60_000,
  });

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    clients?.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [clients]);

  return (
    <ListTemplate
      title="Invoices"
      primaryAction={
        <Link href="/invoices/new">
          <Button>Create invoice</Button>
        </Link>
      }
      filters={FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => setStatus(f.value)}
          className={`font-ui rounded-pill h-8 px-3 text-[0.8125rem] font-semibold transition-colors ${
            status === f.value
              ? "bg-midnight text-white"
              : "bg-surface-secondary text-text-secondary hover:bg-surface-raised"
          }`}
        >
          {f.label}
        </button>
      ))}
    >
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <Card>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            No invoices{status === "all" ? " yet" : ` with status "${status}"`}.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {invoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              clientName={clientNameById.get(invoice.clientId) ?? "Unknown client"}
            />
          ))}
        </div>
      )}
    </ListTemplate>
  );
}
