-- Low-stock alerts (value-add follow-up to the anti-theft/POS feature) —
-- opt-in inventory tracking on Product, nullable so existing products and
-- traders who don't want to count stock are unaffected.
ALTER TABLE "products" ADD COLUMN "stock_quantity" INTEGER;
