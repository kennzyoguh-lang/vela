"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Product } from "@vela/types";
import { SettingsTemplate } from "@/components/templates/SettingsTemplate";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";

// Mirrors apps/api/src/validation/product.schema.ts's fixed allowlists —
// icon/color stay a closed set so the sale-logging grid stays visually
// consistent, never free-text. Duplicated here rather than shared because
// no cross-app validation package exists yet (see that file's own comment
// about the pending OpenAPI generator).
const PRODUCT_ICONS = [
  "package",
  "shirt",
  "battery",
  "wrench",
  "lightbulb",
  "car",
  "smartphone",
  "headphones",
  "shopping-bag",
  "zap",
  "settings",
  "disc",
] as const;

const PRODUCT_COLORS = [
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "indigo",
  "purple",
  "pink",
] as const;

const LOW_STOCK_THRESHOLD = 3;

export default function ProductsSettingsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState<(typeof PRODUCT_ICONS)[number]>(PRODUCT_ICONS[0]);
  const [color, setColor] = useState<(typeof PRODUCT_COLORS)[number]>(PRODUCT_COLORS[0]);
  const [stockQuantity, setStockQuantity] = useState("");

  const {
    data: products,
    isLoading,
    error: productsError,
  } = useQuery({
    queryKey: ["settings-products"],
    queryFn: () => api.get<Product[]>("/v1/products"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Product>("/v1/products", {
        name,
        price: Number(price),
        currency: "NGN",
        icon,
        color,
        stockQuantity: stockQuantity ? Number(stockQuantity) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-products"] });
      setName("");
      setPrice("");
      setStockQuantity("");
    },
  });

  return (
    <SettingsTemplate activePath="/settings/products">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Add a product</CardTitle>
          </CardHeader>
          <p className="font-ui text-text-secondary text-[0.875rem]">
            Shows up as a tile on the sale-logging screen. Stock count is optional — leave it blank
            if you don&apos;t want to track inventory for this item.
          </p>
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                label="Price (NGN)"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
              <div className="flex flex-col gap-1">
                <label className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]">
                  Icon
                </label>
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value as (typeof PRODUCT_ICONS)[number])}
                  className="border-border bg-surface-raised font-ui text-text-primary h-10 rounded-sm border px-3"
                >
                  {PRODUCT_ICONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-ui text-text-secondary text-[0.75rem] font-semibold uppercase tracking-[0.02em]">
                  Colour
                </label>
                <select
                  value={color}
                  onChange={(e) => setColor(e.target.value as (typeof PRODUCT_COLORS)[number])}
                  className="border-border bg-surface-raised font-ui text-text-primary h-10 rounded-sm border px-3"
                >
                  {PRODUCT_COLORS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Stock count (optional)"
                type="number"
                min="0"
                step="1"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                helperText="Leave blank to not track stock for this product"
              />
            </div>
            <Button
              type="submit"
              loading={createMutation.isPending}
              disabled={!name.trim() || !price}
              className="self-start"
            >
              Add product
            </Button>
          </form>
          {createMutation.isError ? (
            <Alert
              variant="danger"
              title={
                createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : "Couldn't add this product"
              }
            />
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
          </CardHeader>
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : productsError ? (
            <p className="font-ui text-status-danger text-[0.875rem]">
              Couldn&apos;t load — try again shortly.
            </p>
          ) : !products || products.length === 0 ? (
            <p className="font-ui text-text-secondary text-[0.875rem]">
              No products yet — add one above.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="border-border flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="font-ui text-text-primary text-[0.875rem] font-semibold">
                      {product.name}
                    </p>
                    <p className="font-ui text-text-secondary text-[0.75rem]">
                      {formatMoney(product.price, product.currency)}
                    </p>
                  </div>
                  {product.stockQuantity !== null ? (
                    <Badge
                      status={product.stockQuantity <= LOW_STOCK_THRESHOLD ? "low-stock" : "active"}
                      label={`${product.stockQuantity} in stock`}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </SettingsTemplate>
  );
}
