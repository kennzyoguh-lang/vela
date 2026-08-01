"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Product, Sale } from "@vela/types";
import { api, ApiError } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { ProductTile } from "@/components/pos/ProductTile";
import { QuantityStepper } from "@/components/pos/QuantityStepper";
import { ConfirmSaleButton } from "@/components/pos/ConfirmSaleButton";
import { VoiceInputButton } from "@/components/pos/VoiceInputButton";
import { LanguageToggle } from "@/components/pos/LanguageToggle";
import { CashCheckNudgeBanner } from "@/components/pos/CashCheckNudgeBanner";
import { NumberPad } from "@/components/pos/NumberPad";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import { CheckCircle2, CloudOff, Wallet, Percent, X, Zap } from "lucide-react";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";
import { useModuleVisibility } from "@/lib/business-profile/useModuleVisibility";

interface SaleSubmission {
  items: { productId: string | null; quantity: number }[];
  customerName?: string;
  discountAmount?: number;
  approvalPin?: string;
}

export default function PosSellPage() {
  const { t } = useTranslation();
  const { visibility } = useModuleVisibility();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  // Anti-theft Piece 4 — discount is opt-in via the "+ Discount" chip below,
  // so the default no-discount sale-logging path (product tile → confirm)
  // stays at 2 taps. discountOpen is its own flag (not derived from
  // discountDigits) so the panel can be reopened empty after "Remove discount".
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountDigits, setDiscountDigits] = useState("");
  const [approvalPinDigits, setApprovalPinDigits] = useState("");
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const enqueue = useOfflineQueueStore((s) => s.enqueue);

  const { data: products, isLoading } = useQuery({
    queryKey: ["pos-products"],
    queryFn: () => api.get<Product[]>("/v1/products"),
    staleTime: 60_000,
  });

  function resetDiscount() {
    setDiscountOpen(false);
    setDiscountDigits("");
    setApprovalPinDigits("");
  }

  function resetSaleForm() {
    setSelectedProductId(null);
    setQuantity(1);
    setCustomerName("");
    resetDiscount();
  }

  const saleMutation = useMutation({
    mutationFn: (input: SaleSubmission) => api.post<Sale>("/v1/sales", input),
    onSuccess: (sale) => {
      setLastSale(sale);
      resetSaleForm();
    },
    onError: (err, input) => {
      // A real ApiError (wrong PIN, unknown product, etc.) is the caller's
      // own mistake — surface it via the Alert below, never queue it. Any
      // other error means the request never reached the server at all
      // (offline, DNS failure, timeout) — the sale itself is still good, so
      // save it locally rather than losing the trader's work.
      if (err instanceof ApiError) return;
      enqueue("/v1/sales", input);
      setSavedOffline(true);
      resetSaleForm();
    },
  });

  const selectedProduct = products?.find((p) => p.id === selectedProductId) ?? null;

  if (lastSale || savedOffline) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        {savedOffline ? (
          <CloudOff className="text-cobalt size-24" aria-hidden />
        ) : (
          <CheckCircle2 className="text-sage size-24" aria-hidden />
        )}
        <p className="font-ui text-[1.75rem] font-bold text-white">
          {savedOffline ? t("pos.sell.savedOffline") : t("pos.sell.success")}
        </p>
        <button
          type="button"
          onClick={() => {
            setLastSale(null);
            setSavedOffline(false);
          }}
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
        <div className="flex items-center gap-2">
          {visibility.quickSale ? (
            <Link
              href="/pos/quick-sale"
              className="bg-gold text-midnight font-ui flex items-center gap-2 rounded-full px-3 py-2 text-[0.8125rem] font-bold"
            >
              <Zap className="size-4" aria-hidden />
              {t("pos.nav.quickSale")}
            </Link>
          ) : null}
          {visibility.cashReconciliation ? (
            <Link
              href="/pos/cash-check"
              className="bg-surface-secondary text-text-primary font-ui flex items-center gap-2 rounded-full px-3 py-2 text-[0.8125rem] font-bold"
            >
              <Wallet className="size-4" aria-hidden />
              {t("pos.nav.cashCheck")}
            </Link>
          ) : null}
          <LanguageToggle />
        </div>
      </div>

      {visibility.cashReconciliation ? <CashCheckNudgeBanner /> : null}

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

          {discountOpen ? (
            <div className="flex flex-col gap-4 rounded-2xl bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <p className="font-ui text-[0.875rem] font-semibold text-white/70">
                  {t("pos.sell.discountAmount")}
                </p>
                <button
                  type="button"
                  onClick={resetDiscount}
                  aria-label={t("pos.sell.removeDiscount")}
                  className="text-white/50"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <NumberPad
                digits={discountDigits}
                onChange={setDiscountDigits}
                clearLabel={t("pos.cashCheck.clear")}
              />
              {discountDigits ? (
                <>
                  <p className="font-ui text-center text-[0.8125rem] text-white/70">
                    {t("pos.sell.discountAskManager")}
                  </p>
                  <p className="font-ui text-center text-[0.875rem] font-semibold text-white/70">
                    {t("pos.sell.approvalPin")}
                  </p>
                  <NumberPad
                    digits={approvalPinDigits}
                    onChange={setApprovalPinDigits}
                    clearLabel={t("pos.cashCheck.clear")}
                    mode="pin"
                  />
                </>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDiscountOpen(true)}
              className="bg-surface-secondary text-text-primary font-ui mx-auto flex items-center gap-2 rounded-full px-4 py-2 text-[0.875rem] font-semibold"
            >
              <Percent className="size-4" aria-hidden />
              {t("pos.sell.discount")}
            </button>
          )}

          <ConfirmSaleButton
            label={t("pos.sell.confirm")}
            loadingLabel={t("pos.sell.confirming")}
            loading={saleMutation.isPending}
            disabled={quantity < 1}
            onClick={() =>
              saleMutation.mutate({
                items: [{ productId: selectedProductId, quantity }],
                customerName: customerName || undefined,
                discountAmount: discountDigits ? Number(discountDigits) : undefined,
                // Owner/admin don't need this — the server only checks it
                // for the "staff" role (sale.service.ts#verifyDiscountApproval)
                // — so it's sent whenever typed, never required client-side.
                approvalPin: approvalPinDigits || undefined,
              })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
