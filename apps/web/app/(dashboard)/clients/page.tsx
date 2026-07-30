"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Client, Page } from "@vela/types";
import { ListTemplate } from "@/components/templates/ListTemplate";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";

export default function ClientsPage() {
  const { data: clientPage, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<Page<Client>>("/v1/clients?pageSize=100"),
    staleTime: 5 * 60_000,
  });
  const clients = clientPage?.items;

  return (
    <ListTemplate
      title="Clients"
      primaryAction={
        <Link href="/clients/new">
          <Button>Add client</Button>
        </Link>
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !clients || clients.length === 0 ? (
        <Card>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            No clients yet. Add one to start invoicing.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {clients.map((client) => (
            <Card key={client.id} className="flex items-center justify-between">
              <div>
                <p className="font-ui text-text-primary text-[0.875rem] font-semibold">
                  {client.name}
                </p>
                <p className="font-ui text-text-secondary text-[0.75rem]">
                  {client.email ?? "No email on file"}
                </p>
              </div>
              <p className="font-ui text-text-secondary text-[0.75rem]">
                {client.paymentTerms}-day terms
              </p>
            </Card>
          ))}
        </div>
      )}
    </ListTemplate>
  );
}
