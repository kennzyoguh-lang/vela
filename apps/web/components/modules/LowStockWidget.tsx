"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PackageX } from "lucide-react";
import type { Product } from "@vela/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api/client";

// Low-stock alerts (value-add follow-up) — only surfaces products that
// opted into stock tracking (Settings -> Products), so an org that never
// sets a stock count just sees the empty state, never a false alarm.
export function LowStockWidget() {
  const { data: lowStock, isLoading } = useQuery({
    queryKey: ["products", "low-stock"],
    queryFn: () => api.get<Product[]>("/v1/products/low-stock"),
    staleTime: 30_000,
  });

  return (
    <Card className="flex h-full flex-col justify-between gap-4">
      <div>
        <CardHeader>
          <CardTitle>Low stock</CardTitle>
          <PackageX className="text-text-secondary size-4" aria-hidden />
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-6 w-2/3" />
        ) : !lowStock || lowStock.length === 0 ? (
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Nothing running low — or stock tracking isn&apos;t set up yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {lowStock.slice(0, 4).map((product) => (
              <li
                key={product.id}
                className="font-ui text-text-primary flex justify-between text-[0.875rem]"
              >
                <span>{product.name}</span>
                <span className="font-semibold">{product.stockQuantity} left</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link href="/settings/products">
        <Button variant="secondary" size="sm">
          View products
        </Button>
      </Link>
    </Card>
  );
}
