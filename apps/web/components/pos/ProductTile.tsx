"use client";

import {
  Package,
  Shirt,
  Battery,
  Wrench,
  Lightbulb,
  Car,
  Smartphone,
  Headphones,
  ShoppingBag,
  Zap,
  Settings,
  Disc,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { Product } from "@vela/types";

const ICON_MAP: Record<string, LucideIcon> = {
  package: Package,
  shirt: Shirt,
  battery: Battery,
  wrench: Wrench,
  lightbulb: Lightbulb,
  car: Car,
  smartphone: Smartphone,
  headphones: Headphones,
  "shopping-bag": ShoppingBag,
  zap: Zap,
  settings: Settings,
  disc: Disc,
};

// Tailwind's built-in default palette (red/orange/.../pink), not VELA's
// custom design-token colors — the token palette (midnight/gold/cobalt/...)
// has no room for a 9-way product-category color set, and these tiles are
// deliberately a distinct visual language from the rest of the dashboard.
const COLOR_MAP: Record<string, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

interface ProductTileProps {
  product: Product;
  selected: boolean;
  onSelect: () => void;
}

// Deliberately not extending the shared Button component — this is an
// oversized, icon-first touch target well above Button's 44px floor, and
// keeping it separate means POS sizing can never accidentally regress
// dashboard button sizing or vice versa.
export function ProductTile({ product, selected, onSelect }: ProductTileProps) {
  const Icon = ICON_MAP[product.icon] ?? Package;
  const colorClass = COLOR_MAP[product.color] ?? "bg-slate-500";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border-4 p-3",
        "transition-transform active:scale-95",
        selected ? "border-gold" : "border-transparent",
      )}
    >
      <div className={cn("flex size-16 items-center justify-center rounded-full", colorClass)}>
        <Icon className="size-9 text-white" aria-hidden />
      </div>
      <span className="font-ui text-text-primary line-clamp-2 text-center text-[1rem] font-bold leading-tight">
        {product.name}
      </span>
      <span className="font-data text-text-secondary text-[0.875rem] font-bold">
        {formatMoney(product.price, product.currency)}
      </span>
    </button>
  );
}
