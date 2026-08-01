import { z } from "zod";

// Fixed allowlists, never free-text — icon is a lucide-react icon name
// rendered via a lookup map on the frontend, color is a design-token swatch
// name, not a raw hex, so the sale-logging grid stays visually consistent
// and can't be used to inject arbitrary content.
export const PRODUCT_ICONS = [
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

export const PRODUCT_COLORS = [
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

export const createProductSchema = z.object({
  name: z.string().min(1).max(120),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default("NGN"),
  icon: z.enum(PRODUCT_ICONS),
  color: z.enum(PRODUCT_COLORS),
  // Opt-in inventory tracking (value-add follow-up) — omitted means "don't
  // track stock for this product," not zero.
  stockQuantity: z.number().int().nonnegative().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
