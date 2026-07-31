"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Product, Sale } from "@vela/types";
import { api, ApiError } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { ProductTile } from "@/components/pos/ProductTile";
import { QuantityStepper } from "@/components/pos/QuantityStepper";
import { ConfirmSaleButton } from "@/components/pos/ConfirmSaleButton";
import { VoiceInputButton } from "@/components/pos/VoiceInputButton";
import { LanguageToggle } from "@/components/pos/LanguageToggle";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { CheckCircle2 } from "lucide-react";

export default function PosSellPage() {
  const { t } = useTranslation();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ["pos-products"],
    queryFn: () => api.get<Product[]>("/v1/products"),
    staleTime: 60_000,
  });

  const saleMutation = useMutation({
    mutationFn: () =>
      api.post<Sale>("/v1/sales", {
        items: [{ productId: selectedProductId, quantity }],
        customerName: customerName || undefined,
      }),
    onSuccess: (sale) => {
      setLastSale(sale);
      setSelectedProductId(null);
      setQuantity(1);
      setCustomerName("");
    },
  });

  const selectedProduct = products?.find((p) => p.id === selectedProductId) ?? null;

  if (lastSale) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <CheckCircle2 className="text-sage size-24" aria-hidden />
        <p className="font-ui text-[1.75rem] font-bold text-white">{t("pos.sell.success")}</p>
        <button
          type="button"
          onClick={() => setLastSale(null)}
          className="font-ui bg-gold text-midnight mt-4 min-h-[64px] rounded-2xl px-10 text-[1.25rem] font-bold active:scale-95"
        >
          {t("pos.sell.title")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-ui text-[1.5rem] font-bold text-white">{t("pos.sell.title")}</h1>
        <LanguageToggle />
      </div>

      {saleMutation.isError ? (
        <Alert
          variant="danger"
          title={
            saleMutation.error instanceof ApiError
              ? saleMutation.error.message
              : t("pos.sell.error")
          }
        />
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : !products || products.length === 0 ? (
        <p className="font-ui text-center text-[1rem] text-white/70">{t("pos.sell.empty")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((product) => (
            <ProductTile
              key={product.id}
              product={product}
              selected={product.id === selectedProductId}
              onSelect={() => setSelectedProductId(product.id)}
            />
          ))}
        </div>
      )}

      {selectedProduct ? (
        <div className="mt-auto flex flex-col gap-6 rounded-2xl bg-white/5 p-4">
          <QuantityStepper
            quantity={quantity}
            onChange={setQuantity}
            label={t("pos.sell.quantity")}
          />
          <div className="flex justify-center">
            <VoiceInputButton value={customerName} onChange={setCustomerName} />
          </div>
          <ConfirmSaleButton
            label={t("pos.sell.confirm")}
            loadingLabel={t("pos.sell.confirming")}
            loading={saleMutation.isPending}
            disabled={quantity < 1}
            onClick={() => saleMutation.mutate()}
          />
        </div>
      ) : null}
    </div>
  );
}
