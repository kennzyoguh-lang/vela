"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Client, Page, Quote, QuoteStatus } from "@vela/types";
import { ListTemplate } from "@/components/templates/ListTemplate";
import { QuoteCard } from "@/components/modules/QuoteCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { quoteStatusLabel } from "@/lib/quote-status";
import { api } from "@/lib/api/client";

// Mirrors app/(dashboard)/invoices/page.tsx exactly.
const FILTERS: { label: string; value: QuoteStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: quoteStatusLabel("draft"), value: "draft" },
  { label: quoteStatusLabel("sent"), value: "sent" },
  { label: quoteStatusLabel("accepted"), value: "accepted" },
  { label: quoteStatusLabel("declined"), value: "declined" },
  { label: quoteStatusLabel("expired"), value: "expired" },
];

export default function QuotesPage() {
  const [status, setStatus] = useState<QuoteStatus | "all">("all");

  const { data: quotePage, isLoading } = useQuery({
    queryKey: ["quotes", status],
    queryFn: () =>
      api.get<Page<Quote>>(`/v1/quotes?pageSize=100${status === "all" ? "" : `&status=${status}`}`),
    staleTime: 30_000,
  });
  const quotes = quotePage?.items;

  const { data: clientPage } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<Page<Client>>("/v1/clients?pageSize=100"),
    staleTime: 5 * 60_000,
  });

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    clientPage?.items.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [clientPage]);

  return (
    <ListTemplate
      title="Quotes"
      primaryAction={
        <Link href="/quotes/new">
          <Button>Create quote</Button>
        </Link>
      }
      filters={FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => setStatus(f.value)}
          className={`font-ui rounded-pill h-11 px-3 text-[0.8125rem] font-semibold transition-colors ${
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
      ) : !quotes || quotes.length === 0 ? (
        <Card>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            No quotes{status === "all" ? " yet" : ` with status "${status}"`}.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {quotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              clientName={clientNameById.get(quote.clientId) ?? "Unknown client"}
            />
          ))}
        </div>
      )}
    </ListTemplate>
  );
}
